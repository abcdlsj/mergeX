/**
 * MergeX - Background Service Worker
 * Handles duplicate tab prevention and management
 */

// Build URL for comparison based on site settings
function buildComparisonUrl(url, siteSetting) {
  let result = url.origin + url.pathname;
  
  // Default behavior: ignore query params and hash (smart deduplication)
  if (!siteSetting) {
    return result;
  }
  
  // Add query parameters if included in site setting
  if (siteSetting.includeQuery) {
    result += url.search;
  }
  
  // Add hash if included in site setting
  if (siteSetting.includeHash) {
    result += url.hash;
  }
  
  return result;
}

// Track recently processed tabs to avoid duplicate handling
const recentlyProcessedTabs = new Set();

// Check for duplicates function
async function checkForDuplicates(tabId, url) {
  if (!url || url === 'about:blank' || recentlyProcessedTabs.has(tabId)) {
    return;
  }

  // Mark as processing immediately to prevent race conditions
  recentlyProcessedTabs.add(tabId);

  try {
    // Get user settings
    const { preventDuplicates, siteSettings } = await chrome.storage.sync.get(['preventDuplicates', 'siteSettings']);

    // Exit if duplicate prevention is disabled
    if (!preventDuplicates) {
      recentlyProcessedTabs.delete(tabId);
      return;
    }

    // Parse the current tab's URL
    const currentTabUrl = new URL(url);
    
    // Find matching site-specific settings
    const siteSetting = Array.isArray(siteSettings) ? siteSettings.find(s => {
      if (s.matchType === 'exact') {
        return currentTabUrl.hostname + currentTabUrl.pathname === s.domain;
      } else if (s.matchType === 'domain') {
        return currentTabUrl.hostname === s.domain;
      } else if (s.matchType === 'prefix') {
        const [domain, ...pathParts] = s.domain.split('/');
        const prefix = pathParts.join('/');
        return currentTabUrl.hostname === domain && 
               currentTabUrl.pathname.startsWith('/' + prefix);
      }
      // Default: exact match on hostname + pathname
      return currentTabUrl.hostname + currentTabUrl.pathname === s.domain;
    }) : undefined;

    // Check if deduplication is disabled for this site
    if (siteSetting && siteSetting.disabled) {
      recentlyProcessedTabs.delete(tabId);
      return;
    }

    // Build URL for comparison
    let urlToCompare = buildComparisonUrl(currentTabUrl, siteSetting);

    // Get current tab info
    const currentTab = await chrome.tabs.get(tabId);
    
    // Only check tabs in the same window
    const allTabs = await chrome.tabs.query({ windowId: currentTab.windowId });
    
    // Look for duplicates
    for (const existingTab of allTabs) {
      if (existingTab.id === tabId || !existingTab.url || recentlyProcessedTabs.has(existingTab.id)) {
        continue;
      }

      try {
        const existingTabUrl = new URL(existingTab.url);
        const existingTabUrlString = buildComparisonUrl(existingTabUrl, siteSetting);

        if (urlToCompare === existingTabUrlString) {
          // Focus existing tab and close new one
          try {
            await chrome.tabs.update(existingTab.id, { active: true });
            await chrome.windows.update(currentTab.windowId, { focused: true });
          } catch (_) {}

          await chrome.tabs.remove(tabId);
          return;
        }
      } catch (error) {
        console.error('Error processing tab:', error);
      }
    }

    // Clean up after delay if no duplicate found
    setTimeout(() => {
      recentlyProcessedTabs.delete(tabId);
    }, 3000);
    
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    setTimeout(() => {
      recentlyProcessedTabs.delete(tabId);
    }, 1000);
  }
}

// Initialize settings on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['preventDuplicates', 'siteSettings'], (result) => {
    if (result.preventDuplicates === undefined) {
      chrome.storage.sync.set({ preventDuplicates: true });
    }
    if (result.siteSettings === undefined) {
      chrome.storage.sync.set({ siteSettings: [] });
    }
  });
});

// Listen for tab update events  
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check on URL change (immediate), loading (paste scenarios), or complete (fallback)
  if (changeInfo.url) {
    await checkForDuplicates(tabId, changeInfo.url);
  } else if (changeInfo.status === 'loading' && tab.url) {
    await checkForDuplicates(tabId, tab.url);
  } else if (changeInfo.status === 'complete' && tab.url) {
    await checkForDuplicates(tabId, tab.url);
  }
});