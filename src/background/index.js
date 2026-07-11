/**
 * MergeX background worker.
 * Duplicate protection is deliberately always-on. The only exceptions are
 * explicit site rules created by the user.
 */

const processingTabs = new Set()
const processingKeys = new Set()

const domainMatches = (hostname, pattern) => {
  if (!hostname || !pattern) return false
  const host = hostname.toLowerCase()
  const rule = pattern.toLowerCase()
  if (host === rule) return true
  if (rule.startsWith('*.')) {
    const base = rule.slice(2)
    return host === base || host.endsWith(`.${base}`)
  }
  return host.endsWith(`.${rule}`)
}

const findSiteRule = (url, siteSettings) => {
  if (!Array.isArray(siteSettings)) return undefined
  return siteSettings
    .filter((rule) => domainMatches(url.hostname, rule.domain))
    .sort((a, b) => (b.domain?.length || 0) - (a.domain?.length || 0))[0]
}

const comparisonKey = (url, rule) => {
  let key = `${url.origin}${url.pathname}`
  if (!rule?.ignoreQuery) key += url.search
  if (!rule?.ignoreHash) key += url.hash
  return key
}

const isSupportedUrl = (value) => {
  if (!value || value === 'about:blank') return false
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'file:', 'ftp:'].includes(url.protocol)
  } catch {
    return false
  }
}

const recordRedirect = async () => {
  const { duplicateStats = {} } = await chrome.storage.local.get('duplicateStats')
  await chrome.storage.local.set({
    duplicateStats: {
      count: (duplicateStats.count || 0) + 1,
      lastRedirectedAt: Date.now(),
    },
  })
}

const clearExpiredSnooze = async (rule) => {
  if (!rule?.disabledUntil || rule.disabledUntil > Date.now()) return
  const { siteSettings = [] } = await chrome.storage.sync.get('siteSettings')
  const index = siteSettings.findIndex((item) => item.domain === rule.domain)
  if (index === -1) return
  const next = [...siteSettings]
  next[index] = { ...next[index] }
  delete next[index].disabledUntil
  await chrome.storage.sync.set({ siteSettings: next })
}

async function redirectDuplicate(tabId, rawUrl) {
  if (!isSupportedUrl(rawUrl) || processingTabs.has(tabId)) return
  processingTabs.add(tabId)

  let activeKey
  let ownsActiveKey = false
  try {
    const currentTab = await chrome.tabs.get(tabId)
    if (currentTab.pinned) return

    const currentUrl = new URL(rawUrl)
    const { siteSettings = [] } = await chrome.storage.sync.get('siteSettings')
    const rule = findSiteRule(currentUrl, siteSettings)
    const snoozed = typeof rule?.disabledUntil === 'number' && rule.disabledUntil > Date.now()
    if (rule?.disabled || snoozed) return
    await clearExpiredSnooze(rule)

    const key = comparisonKey(currentUrl, rule)
    activeKey = `${currentTab.windowId}:${key}`
    if (processingKeys.has(activeKey)) return
    processingKeys.add(activeKey)
    ownsActiveKey = true
    const tabs = await chrome.tabs.query({ windowId: currentTab.windowId })
    const duplicate = tabs
      .filter((tab) => tab.id !== tabId && !tab.pinned && isSupportedUrl(tab.url))
      .sort((a, b) => a.index - b.index)
      .find((tab) => {
        try {
          return comparisonKey(new URL(tab.url), rule) === key
        } catch {
          return false
        }
      })

    if (!duplicate) return

    // Redirect attention to the tab that already exists, then remove only the
    // newly opened duplicate. This keeps navigation history and page state.
    await chrome.tabs.update(duplicate.id, { active: true }).catch(() => {})
    await chrome.windows.update(currentTab.windowId, { focused: true }).catch(() => {})
    await chrome.tabs.remove(tabId)
    await recordRedirect()
  } catch (error) {
    // A tab can disappear while its URL is changing. That is normal and does
    // not warrant surfacing an extension error to the user.
    if (!String(error?.message || error).includes('No tab with id')) {
      console.error('[MergeX] Duplicate protection failed', error)
    }
  } finally {
    processingTabs.delete(tabId)
    if (ownsActiveKey) processingKeys.delete(activeKey)
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const { siteSettings } = await chrome.storage.sync.get('siteSettings')
  const updates = { preventDuplicates: true }
  if (reason === 'install' || !Array.isArray(siteSettings)) updates.siteSettings = []
  await chrome.storage.sync.set(updates)
})

chrome.runtime.onStartup.addListener(() => {
  // Keep the legacy key truthful for users upgrading from versions where this
  // was a switch. Runtime behavior no longer depends on it.
  chrome.storage.sync.set({ preventDuplicates: true })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) redirectDuplicate(tabId, changeInfo.url)
  else if (changeInfo.status === 'loading' && tab.url) redirectDuplicate(tabId, tab.url)
})
