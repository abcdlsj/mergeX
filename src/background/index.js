/**
 * MergeX - Background Service Worker
 * Handles duplicate tab prevention and management
 */

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

  // Get user settings
  const { preventDuplicates, siteSettings } = await chrome.storage.sync.get(['preventDuplicates', 'siteSettings']);

  // Exit if duplicate prevention is disabled
  if (!preventDuplicates) {
    return;
  }

  try {
    // Parse the current tab's URL
    const currentTabUrl = new URL(tab.url);
    
    // Find matching site-specific settings
    const siteSetting = siteSettings.find(s =>
      currentTabUrl.hostname + currentTabUrl.pathname === s.domain
    );

    // Determine URL for comparison (with or without query parameters)
    let urlToCompare = tab.url;
    if (siteSetting?.ignoreQuery) {
      urlToCompare = currentTabUrl.origin + currentTabUrl.pathname;
    }

    // Get all open tabs
    const allTabs = await chrome.tabs.query({});
    
    // Look for duplicate tabs
    for (const existingTab of allTabs) {
      // Skip the current tab itself or tabs without URLs
      if (existingTab.id === tabId || !existingTab.url) {
        continue;
      }

      try {
        // Process existing tab's URL
        let existingTabUrlString = existingTab.url;
        if (siteSetting?.ignoreQuery) {
          const existingTabUrl = new URL(existingTab.url);
          existingTabUrlString = existingTabUrl.origin + existingTabUrl.pathname;
        }

        // If duplicate is found
        if (urlToCompare === existingTabUrlString) {
          // Mark current tab as processed
          recentlyProcessedTabs.add(tabId);
          
          // Activate the existing tab
          await chrome.tabs.update(existingTab.id, { active: true });
          await chrome.windows.update(existingTab.windowId, { focused: true });
          
          // Close the duplicate tab
          await chrome.tabs.remove(tabId);
          
          // Remove from processed set after a delay
          setTimeout(() => {
            recentlyProcessedTabs.delete(tabId);
          }, 5000);
          
          return;
        }
      } catch (error) {
        console.error('Error processing tab:', error);
      }
    }
  } catch (error) {
    console.error('Error checking for duplicate tabs:', error);
  }
});
