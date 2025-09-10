document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="header">
      <h1>MergeX Settings</h1>
    </div>
    <div class="card" id="status"></div>
    <div class="card">
      <h3>Protected Sites</h3>
      <p class="description">Sites with custom URL comparison rules. Use popup toggles to add or modify.</p>
      <div id="siteList" class="site-list"></div>
    </div>
  `

  const statusDiv = document.getElementById('status')
  const siteListDiv = document.getElementById('siteList')
  let sites = []

  const renderStatus = ({ preventDuplicates }) => {
    const statusColor = preventDuplicates ? 'var(--success)' : 'var(--danger)'
    const statusText = preventDuplicates ? 'Enabled' : 'Disabled' 
    
    statusDiv.innerHTML = `
      <div class="status-row">
        <div class="status-indicator" style="background-color: ${statusColor}"></div>
        <div class="status-text">
          <strong>Duplicate Prevention:</strong> ${statusText}
        </div>
      </div>
      <p class="description">Change this setting in the popup extension.</p>
    `
  }

  const renderSiteList = (sites) => {
    siteListDiv.innerHTML = ''
    if (!sites || sites.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'empty-state'
      empty.textContent = 'No custom rules yet'
      siteListDiv.appendChild(empty)
      return
    }

    sites.forEach((site, index) => {
      const siteItem = document.createElement('div')
      siteItem.className = 'site-item'
      
      const matchTypeText = {
        'domain': 'Domain-wide',
        'prefix': 'Path prefix', 
        'exact': 'Exact path'
      }[site.matchType || 'exact']
      
      const options = []
      const status = site.disabled ? ' [DISABLED]' : ''
      if (site.includeQuery) options.push('Include query')
      if (site.includeHash) options.push('Include hash')
      const optionsText = options.length > 0 ? ` (${options.join(', ')})` : ''
      
      siteItem.innerHTML = `
        <div class="site-info">
          <div class="site-domain">${site.domain}${status}</div>
          <div class="site-details">${matchTypeText}${optionsText}</div>
        </div>
        <button class="btn-remove" data-index="${index}">Remove</button>
      `
      siteListDiv.appendChild(siteItem)
    })
  }

  const { preventDuplicates, siteSettings } = await chrome.storage.sync.get(['preventDuplicates', 'siteSettings'])
  renderStatus({ preventDuplicates: !!preventDuplicates })
  sites = Array.isArray(siteSettings) ? siteSettings : []
  renderSiteList(sites)

  siteListDiv.addEventListener('click', async (e) => {
    const target = e.target
    if (target.classList.contains('btn-remove')) {
      const idx = parseInt(target.dataset.index, 10)
      if (Number.isNaN(idx)) return
      const res = await chrome.storage.sync.get('siteSettings')
      const current = Array.isArray(res.siteSettings) ? res.siteSettings : []
      if (idx < 0 || idx >= current.length) return
      current.splice(idx, 1)
      await chrome.storage.sync.set({ siteSettings: current })
      sites = current
      renderSiteList(sites)
    }
  })
})
