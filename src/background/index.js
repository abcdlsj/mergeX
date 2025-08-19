/**
 * MergeX - Background Service Worker
 * Handles duplicate tab prevention and management
 */

// Build URL for comparison based on site settings
function buildComparisonUrl(url, siteSetting) {
  let result = url.origin + url.pathname;
  
  if (!siteSetting) {
    // Default behavior: include everything
    return url.href;
  }
  
  // Add query parameters if not ignored
  if (!siteSetting.ignoreQuery) {
    result += url.search;
  }
  
  // Add hash if not ignored
  if (!siteSetting.ignoreHash) {
    result += url.hash;
  }
  
  return result;
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

// Track recently processed tabs to avoid duplicate handling
const recentlyProcessedTabs = new Set();

// Listen for tab update events
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL changes and page is fully loaded
  if (changeInfo.status !== 'complete' || !tab.url || tab.url === 'about:blank') {
    return;
  }

  // Avoid processing the same tab multiple times
  if (recentlyProcessedTabs.has(tabId)) {
    return;
  }

  // Mark as processing immediately to prevent race conditions
  recentlyProcessedTabs.add(tabId);

  // Get user settings
  const { preventDuplicates, siteSettings } = await chrome.storage.sync.get(['preventDuplicates', 'siteSettings']);

  // Exit if duplicate prevention is disabled
  if (!preventDuplicates) {
    recentlyProcessedTabs.delete(tabId);
    return;
  }

  try {
    // Parse the current tab's URL
    const currentTabUrl = new URL(tab.url);
    
    // Find matching site-specific settings with flexible matching
    const siteSetting = siteSettings.find(s => {
      if (s.matchType === 'exact') {
        // Exact path matching (old behavior)
        return currentTabUrl.hostname + currentTabUrl.pathname === s.domain;
      } else if (s.matchType === 'domain') {
        // Domain-wide matching
        return currentTabUrl.hostname === s.domain;
      } else if (s.matchType === 'prefix') {
        // Path prefix matching
        const [domain, ...pathParts] = s.domain.split('/');
        const prefix = pathParts.join('/');
        return currentTabUrl.hostname === domain && 
               currentTabUrl.pathname.startsWith('/' + prefix);
      }
      // Fallback to exact matching for backward compatibility
      return currentTabUrl.hostname + currentTabUrl.pathname === s.domain;
    });

    // Build URL for comparison based on settings
    let urlToCompare = buildComparisonUrl(currentTabUrl, siteSetting);

    // Only check tabs in the same window
    const allTabs = await chrome.tabs.query({ windowId: tab.windowId });
    
    // Look for duplicate tabs, prioritizing older tabs to keep
    let duplicateFound = false;
    for (const existingTab of allTabs) {
      // Skip the current tab itself or tabs without URLs
      if (existingTab.id === tabId || !existingTab.url) {
        continue;
      }

      // Skip tabs that are also being processed to avoid mutual deletion
      if (recentlyProcessedTabs.has(existingTab.id)) {
        continue;
      }

      try {
        // Process existing tab's URL with same settings
        const existingTabUrl = new URL(existingTab.url);
        const existingTabUrlString = buildComparisonUrl(existingTabUrl, siteSetting);

        // If duplicate is found
        if (urlToCompare === existingTabUrlString) {
          duplicateFound = true;
          
          // Determine which tab to keep based on creation time or activity
          // Keep the existing tab (older) and close the new one
          try {
            // Focus the existing tab instead of the new one
            await chrome.tabs.update(existingTab.id, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });
          } catch (_) {}

          // Close the newer tab (current tab)
          await chrome.tabs.remove(tabId);
          break;
        }
      } catch (error) {
        console.error('Error processing tab:', error);
      }
    }

    // If no duplicate found, keep the tab and remove from processed set after delay
    if (!duplicateFound) {
      setTimeout(() => {
        recentlyProcessedTabs.delete(tabId);
      }, 3000);
    }
    
  } catch (error) {
    console.error('Error checking for duplicate tabs:', error);
    // Clean up on error
    setTimeout(() => {
      recentlyProcessedTabs.delete(tabId);
    }, 1000);
  }
});
