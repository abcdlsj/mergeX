document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app')
  app.innerHTML = `
    <h1>Settings Overview</h1>
    <div class="setting-item" id="status"></div>
    <div class="setting-item">
      <h3>Protected Entries</h3>
      <p style="margin-top:6px; color:#6b7280;">Below is the list of protected keys (hostname + pathname) and whether query parameters are ignored. To add or modify, please use the popup quick toggles.</p>
      <div id="siteList" class="site-list"></div>
    </div>
  `

  const statusDiv = document.getElementById('status')
  const siteListDiv = document.getElementById('siteList')
  let sites = []

  const renderStatus = ({ preventDuplicates }) => {
    statusDiv.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:10px; height:10px; border-radius:50%; background:${preventDuplicates ? '#34a853' : '#ea4335'};"></div>
        <div><strong>Prevent duplicate tabs:</strong> ${preventDuplicates ? 'Enabled' : 'Disabled'}</div>
      </div>
      <p style="margin:8px 0 0; color:#6b7280;">To change this, open the extension popup and use the quick toggles.</p>
    `
  }

  const renderSiteList = (sites) => {
    siteListDiv.innerHTML = ''
    if (!sites || sites.length === 0) {
      const empty = document.createElement('div')
      empty.style.color = '#6b7280'
      empty.textContent = 'No entries yet'
      siteListDiv.appendChild(empty)
      return
    }

    sites.forEach((site, index) => {
      const siteItem = document.createElement('div')
      siteItem.className = 'site-item'
      siteItem.innerHTML = `
        <span>${site.domain}</span>
        <label>
          <input type="checkbox" disabled ${site.ignoreQuery ? 'checked' : ''}>
          Ignore query
        </label>
        <button class="remove-site" data-index="${index}">Remove</button>
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
    if (target.classList.contains('remove-site')) {
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
