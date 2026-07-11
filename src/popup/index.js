import './index.css'

const icons = {
  settings: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>`,
  merge: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v3a5 5 0 0 0 5 5h7"/><path d="m16 9 3 3-3 3"/><path d="M7 20v-3a5 5 0 0 1 5-5"/></svg>`,
  sort: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h13M4 12h10M4 17h7"/><path d="m17 15 3 3 3-3M20 6v12"/></svg>`,
  domain: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
  age: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  ungroup: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="12" height="12" rx="2"/><path d="M9 16v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-4"/></svg>`,
}

const getHostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const getRuleDomain = (url) => {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.hostname.toLowerCase() : ''
  } catch {
    return ''
  }
}

const setBadge = async (text, failed = false) => {
  await chrome.action.setBadgeText({ text: String(text) })
  await chrome.action.setBadgeBackgroundColor({ color: failed ? '#a0493e' : '#43634f' })
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2400)
}

const moveTabs = async (tabs) => {
  for (let index = 0; index < tabs.length; index += 1) {
    await chrome.tabs.move(tabs[index].id, { index })
  }
}

const actions = {
  async merge() {
    const [windows, currentWindow] = await Promise.all([
      chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }),
      chrome.windows.getCurrent(),
    ])
    const target = windows.find((item) => item.id === currentWindow.id)
    if (!target) return { message: 'Current window is unavailable' }

    const seenUrls = new Set()
    const duplicateIds = []
    for (const tab of target.tabs || []) {
      if (!tab.url || tab.pinned) continue
      if (seenUrls.has(tab.url)) duplicateIds.push(tab.id)
      else seenUrls.add(tab.url)
    }

    const movePlans = []
    let targetPinnedCount = (target.tabs || []).filter((tab) => tab.pinned).length
    for (const source of windows) {
      if (source.id === currentWindow.id) continue
      const groups = await chrome.tabGroups.query({ windowId: source.id }).catch(() => [])
      const groupMeta = new Map(groups.map((group) => [group.id, group]))
      const grouped = new Map()
      const loose = []
      const pinned = []

      for (const tab of source.tabs || []) {
        if (tab.pinned) {
          pinned.push(tab.id)
          continue
        }
        if (tab.url && !tab.pinned && seenUrls.has(tab.url)) {
          duplicateIds.push(tab.id)
          continue
        }
        if (tab.url && !tab.pinned) seenUrls.add(tab.url)
        if (tab.groupId !== chrome.tabs.TAB_ID_NONE) {
          if (!grouped.has(tab.groupId)) grouped.set(tab.groupId, [])
          grouped.get(tab.groupId).push(tab.id)
        } else {
          loose.push(tab.id)
        }
      }
      movePlans.push({ pinned, loose, grouped, groupMeta })
    }

    if (duplicateIds.length) await chrome.tabs.remove(duplicateIds).catch(() => {})

    let moved = 0
    for (const plan of movePlans) {
      for (const tabId of plan.pinned) {
        await chrome.tabs.move(tabId, { windowId: currentWindow.id, index: targetPinnedCount })
        targetPinnedCount += 1
        moved += 1
      }
      const tabIds = [...plan.loose, ...[...plan.grouped.values()].flat()]
      if (!tabIds.length) continue
      await chrome.tabs.move(tabIds, { windowId: currentWindow.id, index: -1 })
      moved += tabIds.length
      for (const [oldGroupId, ids] of plan.grouped) {
        const survivingIds = ids.filter((id) => tabIds.includes(id))
        if (!survivingIds.length) continue
        const newGroupId = await chrome.tabs.group({ tabIds: survivingIds })
        const meta = plan.groupMeta.get(oldGroupId)
        if (meta) {
          await chrome.tabGroups.update(newGroupId, {
            title: meta.title,
            color: meta.color,
            collapsed: meta.collapsed,
          })
        }
      }
    }
    return {
      count: moved + duplicateIds.length,
      message: duplicateIds.length
        ? `Merged windows · removed ${duplicateIds.length} duplicate${duplicateIds.length === 1 ? '' : 's'}`
        : moved
          ? `Moved ${moved} tab${moved === 1 ? '' : 's'} into this window`
          : 'Everything is already together',
    }
  },

  async sort() {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const sorted = [...tabs].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return getHostname(a.url).localeCompare(getHostname(b.url)) || a.index - b.index
    })
    await moveTabs(sorted)
    return { count: sorted.length, message: `Sorted ${sorted.length} tabs by website` }
  },

  async domain() {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const domains = new Map()
    for (const tab of tabs) {
      if (tab.pinned || tab.active || !tab.url) continue
      const hostname = getHostname(tab.url)
      if (!hostname) continue
      if (!domains.has(hostname)) domains.set(hostname, [])
      domains.get(hostname).push(tab.id)
    }
    const colors = ['blue', 'green', 'purple', 'cyan', 'orange', 'pink', 'yellow', 'red']
    let groupedCount = 0
    let colorIndex = 0
    for (const [hostname, tabIds] of domains) {
      if (tabIds.length < 2) continue
      const groupId = await chrome.tabs.group({ tabIds })
      await chrome.tabGroups.update(groupId, {
        title: hostname.split('.')[0],
        color: colors[colorIndex % colors.length],
      })
      groupedCount += tabIds.length
      colorIndex += 1
    }
    return {
      count: groupedCount,
      message: groupedCount
        ? `Grouped ${groupedCount} tabs by website`
        : 'No websites need grouping',
    }
  },

  async age() {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const older = tabs.filter(
      (tab) =>
        !tab.pinned &&
        !tab.active &&
        now - (tab.lastAccessed || now) >= day &&
        now - (tab.lastAccessed || now) < day * 3,
    )
    const oldest = tabs.filter(
      (tab) => !tab.pinned && !tab.active && now - (tab.lastAccessed || now) >= day * 3,
    )
    if (older.length) {
      const id = await chrome.tabs.group({ tabIds: older.map((tab) => tab.id) })
      await chrome.tabGroups.update(id, { title: 'A while ago', color: 'yellow', collapsed: true })
    }
    if (oldest.length) {
      const id = await chrome.tabs.group({ tabIds: oldest.map((tab) => tab.id) })
      await chrome.tabGroups.update(id, { title: 'Older', color: 'grey', collapsed: true })
    }
    const count = older.length + oldest.length
    return { count, message: count ? `Put ${count} older tabs aside` : 'No older tabs to tidy' }
  },

  async ungroup() {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const grouped = tabs.filter((tab) => tab.groupId !== chrome.tabs.TAB_ID_NONE)
    if (grouped.length) await chrome.tabs.ungroup(grouped.map((tab) => tab.id))
    return {
      count: grouped.length,
      message: grouped.length ? `Ungrouped ${grouped.length} tabs` : 'There are no tab groups',
    }
  },
}

const render = async () => {
  const app = document.getElementById('app')
  app.innerHTML = `
    <main class="popup-shell">
      <header class="topbar">
        <div class="brand"><img src="/icons/logo.svg" alt="" /><span>MergeX</span></div>
        <button class="icon-button" id="settingsButton" type="button" aria-label="Open preferences" title="Preferences">${icons.settings}</button>
      </header>

      <section class="overview">
        <p class="eyebrow">CURRENT WINDOW</p>
        <p class="window-count" id="windowCount">Checking tabs…</p>
        <div class="guard-line" aria-label="Duplicate tab protection status">
          <span class="status-dot" aria-hidden="true"></span>
          <span id="guardStats">Duplicate protection is on</span>
          <span class="guard-label">AUTO</span>
        </div>
      </section>

      <button class="primary-action" type="button" data-action="merge">
        <span class="primary-icon">${icons.merge}</span>
        <span><strong>Merge all windows</strong><small>Move tabs here and remove duplicates</small></span>
        <span class="arrow" aria-hidden="true">↗</span>
      </button>

      <section class="current-site" id="currentSiteSection" aria-label="Current site duplicate rules">
        <div class="site-heading">
          <p class="eyebrow">CURRENT SITE</p>
          <code id="currentDomain">—</code>
        </div>
        <div class="site-rule-options">
          <label><input type="checkbox" id="siteIgnoreQuery" /><span>Ignore <b>?query</b></span></label>
          <label><input type="checkbox" id="siteIgnoreHash" /><span>Ignore <b>#anchor</b></span></label>
          <span class="site-rule-state" id="siteRuleState">Exact domain</span>
        </div>
      </section>

      <section class="tools" aria-label="Tab tools">
        <p class="eyebrow">QUICK TIDY</p>
        <div class="tool-grid">
          <button class="tool" type="button" data-action="sort">${icons.sort}<span><strong>Sort tabs</strong><small>By website</small></span><i>01</i></button>
          <button class="tool" type="button" data-action="domain">${icons.domain}<span><strong>Group by site</strong><small>Keep related tabs together</small></span><i>02</i></button>
          <button class="tool" type="button" data-action="age">${icons.age}<span><strong>Set older tabs aside</strong><small>Collapse tabs idle for a day</small></span><i>03</i></button>
          <button class="tool" type="button" data-action="ungroup">${icons.ungroup}<span><strong>Clear all groups</strong><small>Return to a flat tab list</small></span><i>04</i></button>
        </div>
      </section>

      <div class="toast" id="toast" role="status" aria-live="polite"></div>
    </main>
  `

  const [{ duplicateStats = {} }, tabs, { siteSettings = [] }] = await Promise.all([
    chrome.storage.local.get('duplicateStats'),
    chrome.tabs.query({ currentWindow: true }),
    chrome.storage.sync.get('siteSettings'),
  ])
  const groups = new Set(
    tabs.map((tab) => tab.groupId).filter((id) => id !== chrome.tabs.TAB_ID_NONE),
  )
  document.getElementById('windowCount').textContent =
    `${tabs.length} tab${tabs.length === 1 ? '' : 's'}${groups.size ? ` · ${groups.size} group${groups.size === 1 ? '' : 's'}` : ''}`
  if (duplicateStats.count) {
    document.getElementById('guardStats').textContent =
      `${duplicateStats.count} duplicate${duplicateStats.count === 1 ? '' : 's'} redirected`
  }

  const activeTab = tabs.find((tab) => tab.active)
  const currentDomain = getRuleDomain(activeTab?.url)
  const currentSiteSection = document.getElementById('currentSiteSection')
  const queryCheckbox = document.getElementById('siteIgnoreQuery')
  const hashCheckbox = document.getElementById('siteIgnoreHash')
  const siteRuleState = document.getElementById('siteRuleState')
  const rules = Array.isArray(siteSettings) ? siteSettings : []
  const exactRule = rules.find((rule) => rule.domain?.toLowerCase() === currentDomain)

  if (!currentDomain) {
    currentSiteSection.hidden = true
  } else {
    document.getElementById('currentDomain').textContent = currentDomain
    queryCheckbox.checked = !!exactRule?.ignoreQuery
    hashCheckbox.checked = !!exactRule?.ignoreHash
    siteRuleState.textContent = exactRule ? 'Rule active' : 'Exact domain'
  }

  let stateTimer
  const saveCurrentSiteRule = async () => {
    if (!currentDomain) return
    try {
      siteRuleState.textContent = 'Saving…'
      const { siteSettings: latest = [] } = await chrome.storage.sync.get('siteSettings')
      const next = Array.isArray(latest) ? [...latest] : []
      const index = next.findIndex((rule) => rule.domain?.toLowerCase() === currentDomain)
      if (queryCheckbox.checked || hashCheckbox.checked) {
        const rule = {
          ...(index >= 0 ? next[index] : {}),
          domain: currentDomain,
          ignoreQuery: queryCheckbox.checked,
          ignoreHash: hashCheckbox.checked,
          disabled: false,
        }
        delete rule.disabledUntil
        if (index >= 0) next[index] = rule
        else next.push(rule)
      } else if (index >= 0) {
        next.splice(index, 1)
      }
      await chrome.storage.sync.set({ siteSettings: next })
      siteRuleState.textContent =
        queryCheckbox.checked || hashCheckbox.checked ? 'Saved' : 'Rule removed'
      clearTimeout(stateTimer)
      stateTimer = setTimeout(() => {
        siteRuleState.textContent =
          queryCheckbox.checked || hashCheckbox.checked ? 'Rule active' : 'Exact domain'
      }, 1400)
    } catch (error) {
      console.error('[MergeX] Failed to save current site rule', error)
      siteRuleState.textContent = 'Could not save'
    }
  }

  queryCheckbox.addEventListener('change', saveCurrentSiteRule)
  hashCheckbox.addEventListener('change', saveCurrentSiteRule)

  document
    .getElementById('settingsButton')
    .addEventListener('click', () => chrome.runtime.openOptionsPage())
  app.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]')
    if (!button || button.disabled) return
    const action = actions[button.dataset.action]
    if (!action) return
    const toast = document.getElementById('toast')
    button.disabled = true
    button.classList.add('is-busy')
    toast.className = 'toast is-visible'
    toast.textContent = 'Working…'
    try {
      const result = await action()
      toast.textContent = result.message
      await setBadge(result.count || '✓')
      const tabs = await chrome.tabs.query({ currentWindow: true })
      document.getElementById('windowCount').textContent =
        `${tabs.length} tab${tabs.length === 1 ? '' : 's'}`
    } catch (error) {
      console.error(`[MergeX] ${button.dataset.action} failed`, error)
      toast.classList.add('is-error')
      toast.textContent = 'That did not work. Please try again.'
      await setBadge('!', true)
    } finally {
      button.disabled = false
      button.classList.remove('is-busy')
      setTimeout(() => {
        toast.className = 'toast'
      }, 2600)
    }
  })
  chrome.action.setBadgeText({ text: '' })
}

document.addEventListener('DOMContentLoaded', render)
