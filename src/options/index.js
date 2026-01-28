document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="header">
      <h1>MergeX Settings</h1>
    </div>
    <div class="card" id="status"></div>
    <div class="card">
      <h3>Site-Specific Settings</h3>
      <p class="description">Domains with custom duplicate detection rules. Supports exact (example.com) and wildcard (*.example.com).</p>
      <div class="add-form" id="addForm">
        <input id="domainInput" placeholder="example.com or *.example.com" />
        <label class="form-check"><input type="checkbox" id="addIgnoreQuery"/> Ignore query</label>
        <label class="form-check"><input type="checkbox" id="addIgnoreHash"/> Ignore fragments</label>
        <button id="addBtn">Add rule</button>
      </div>
      <div id="siteList" class="site-list"></div>
    </div>
  `

  const statusDiv = document.getElementById('status')
  const siteListDiv = document.getElementById('siteList')
  const addBtn = document.getElementById('addBtn')
  const domainInput = document.getElementById('domainInput')
  const addIgnoreQuery = document.getElementById('addIgnoreQuery')
  const addIgnoreHash = document.getElementById('addIgnoreHash')
  let sites = []

  const renderStatus = ({ preventDuplicates }) => {
    const statusClass = preventDuplicates ? 'status-indicator active' : 'status-indicator'
    const statusText = preventDuplicates ? 'Enabled' : 'Disabled'
    statusDiv.innerHTML = `
      <div class="status-row">
        <div class="${statusClass}"></div>
        <div class="status-text">
          <strong>Duplicate Prevention:</strong> ${statusText}
        </div>
      </div>
      <p class="description">Change this setting in the popup.</p>
    `
  }

  const validatePattern = (p) => {
    if (!p) return false
    const trimmed = p.trim().toLowerCase()
    if (trimmed.startsWith('*.')) {
      const rest = trimmed.slice(2)
      return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(rest)
    }
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)
  }

  const renderSiteList = (sites) => {
    siteListDiv.innerHTML = ''
    if (!sites || sites.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'empty-state'
      empty.textContent = 'No site-specific settings yet.'
      siteListDiv.appendChild(empty)
      return
    }

    sites.forEach((site, index) => {
      const siteItem = document.createElement('div')
      siteItem.className = 'site-item'
      const snoozed = typeof site.disabledUntil === 'number' && site.disabledUntil > Date.now()
      const status = site.disabled ? ' [DISABLED]' : (snoozed ? ' [SNOOZED]' : '')
      const until = snoozed ? ` (until ${new Date(site.disabledUntil).toLocaleString()})` : ''

      siteItem.innerHTML = `
        <div class="site-info">
          <div class="site-domain">${site.domain}${status}${until}</div>
          <div class="site-details">
            <label class="form-check"><input type="checkbox" data-action="toggle" data-field="ignoreQuery" data-index="${index}" ${site.ignoreQuery ? 'checked' : ''}/> Ignore query</label>
            <label class="form-check"><input type="checkbox" data-action="toggle" data-field="ignoreHash" data-index="${index}" ${site.ignoreHash ? 'checked' : ''}/> Ignore fragments</label>
            <label class="form-check"><input type="checkbox" data-action="toggle" data-field="disabled" data-index="${index}" ${site.disabled ? 'checked' : ''}/> Disable</label>
            ${snoozed ? `<button class="btn-remove" data-action="clear-snooze" data-index="${index}">Clear Snooze</button>` : ''}
          </div>
        </div>
        <button class="btn-remove" data-action="remove" data-index="${index}">Remove</button>
      `
      siteListDiv.appendChild(siteItem)
    })
  }

  const { preventDuplicates, siteSettings } = await chrome.storage.sync.get(['preventDuplicates', 'siteSettings'])
  renderStatus({ preventDuplicates: !!preventDuplicates })
  sites = Array.isArray(siteSettings) ? siteSettings : []
  renderSiteList(sites)

  addBtn.addEventListener('click', async () => {
    const value = domainInput.value.trim()
    if (!validatePattern(value)) {
      domainInput.style.border = '1px solid var(--danger)'
      return
    }
    domainInput.style.border = '1px solid var(--border)'
    const res = await chrome.storage.sync.get('siteSettings')
    const current = Array.isArray(res.siteSettings) ? res.siteSettings : []
    const idx = current.findIndex(s => s.domain === value)
    const entry = { domain: value, ignoreQuery: addIgnoreQuery.checked, ignoreHash: addIgnoreHash.checked }
    if (idx === -1) current.push(entry)
    else current[idx] = { ...current[idx], ...entry }
    await chrome.storage.sync.set({ siteSettings: current })
    sites = current
    renderSiteList(sites)
    domainInput.value = ''
    addIgnoreQuery.checked = false
    addIgnoreHash.checked = false
  })

  siteListDiv.addEventListener('click', async (e) => {
    const target = e.target
    if (!(target instanceof HTMLElement)) return
    const action = target.dataset.action
    const idx = parseInt(target.dataset.index || '-1', 10)
    if (Number.isNaN(idx) || idx < 0) return
    const res = await chrome.storage.sync.get('siteSettings')
    const current = Array.isArray(res.siteSettings) ? res.siteSettings : []
    if (idx >= current.length) return

    if (action === 'remove') {
      current.splice(idx, 1)
      await chrome.storage.sync.set({ siteSettings: current })
      sites = current
      renderSiteList(sites)
    }
    if (action === 'clear-snooze') {
      delete current[idx].disabledUntil
      await chrome.storage.sync.set({ siteSettings: current })
      sites = current
      renderSiteList(sites)
    }
  })

  siteListDiv.addEventListener('change', async (e) => {
    const target = e.target
    if (!(target instanceof HTMLInputElement)) return
    if (target.dataset.action !== 'toggle') return
    const idx = parseInt(target.dataset.index || '-1', 10)
    const field = target.dataset.field
    if (Number.isNaN(idx) || idx < 0 || !field) return
    const res = await chrome.storage.sync.get('siteSettings')
    const current = Array.isArray(res.siteSettings) ? res.siteSettings : []
    if (idx >= current.length) return
    current[idx][field] = target.checked
    await chrome.storage.sync.set({ siteSettings: current })
    sites = current
    renderSiteList(sites)
  })
})
