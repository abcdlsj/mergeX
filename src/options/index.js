document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  app.innerHTML = `
    <h1>MergeX Settings</h1>
    <div class="setting-item">
      <label>
        <input type="checkbox" id="preventDuplicates">
        Prevent Duplicate Tabs
      </label>
      <p>Automatically close new tabs that have the same URL as existing tabs.</p>
    </div>
    <div class="setting-item">
      <h3>Site-Specific Settings</h3>
      <p>Add domains that should have special handling when checking for duplicates.</p>
      <input type="text" id="newSite" placeholder="e.g. example.com/path">
      <button id="addSite">Add Site</button>
    </div>
    <div id="siteList" class="site-list"></div>
  `;

  const preventDuplicatesCheckbox = document.getElementById('preventDuplicates');
  const newSiteInput = document.getElementById('newSite');
  const addSiteButton = document.getElementById('addSite');
  const siteListDiv = document.getElementById('siteList');

  const renderSiteList = (sites) => {
    siteListDiv.innerHTML = '';
    sites.forEach((site, index) => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      siteItem.innerHTML = `
        <span>${site.domain}</span>
        <label>
          <input type="checkbox" data-index="${index}" class="ignore-query" ${site.ignoreQuery ? 'checked' : ''}>
          Ignore Query
        </label>
        <button data-index="${index}" class="remove-site">Remove</button>
      `;
      siteListDiv.appendChild(siteItem);
    });
  };

  chrome.storage.sync.get(['preventDuplicates', 'siteSettings'], (result) => {
    preventDuplicatesCheckbox.checked = result.preventDuplicates;
    renderSiteList(result.siteSettings || []);
  });

  preventDuplicatesCheckbox.addEventListener('change', (event) => {
    chrome.storage.sync.set({ preventDuplicates: event.target.checked });
  });

  addSiteButton.addEventListener('click', () => {
    const newSite = newSiteInput.value.trim();
    if (newSite) {
      chrome.storage.sync.get('siteSettings', (result) => {
        const sites = result.siteSettings || [];
        sites.push({ domain: newSite, ignoreQuery: false });
        chrome.storage.sync.set({ siteSettings: sites }, () => {
          renderSiteList(sites);
          newSiteInput.value = '';
        });
      });
    }
  });

  siteListDiv.addEventListener('click', (event) => {
    if (event.target.classList.contains('remove-site')) {
      const index = parseInt(event.target.dataset.index, 10);
      chrome.storage.sync.get('siteSettings', (result) => {
        const sites = result.siteSettings || [];
        sites.splice(index, 1);
        chrome.storage.sync.set({ siteSettings: sites }, () => {
          renderSiteList(sites);
        });
      });
    } else if (event.target.classList.contains('ignore-query')) {
      const index = parseInt(event.target.dataset.index, 10);
      const checked = event.target.checked;
      chrome.storage.sync.get('siteSettings', (result) => {
        const sites = result.siteSettings || [];
        sites[index].ignoreQuery = checked;
        chrome.storage.sync.set({ siteSettings: sites });
      });
    }
  });
});
