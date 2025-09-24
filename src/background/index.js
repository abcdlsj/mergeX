/**
 * MergeX - Background Service Worker
 * Handles duplicate tab prevention and management
 */

// Build URL for comparison based on site settings
function buildComparisonUrl(url, siteSetting) {
  // Always include origin and pathname (same page detection)
  let result = url.origin + url.pathname;
  
  // Default behavior: compare everything (don't ignore)
  if (!siteSetting) {
    // No site setting = compare full URL
    result += url.search + url.hash;
    return result;
  }
  
  // Only add query if NOT ignored
  if (!siteSetting.ignoreQuery) {
    result += url.search;
  }
  
  // Only add hash if NOT ignored  
  if (!siteSetting.ignoreHash) {
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
    
    // Find matching site-specific settings (supports exact, base-domain and wildcard patterns)
    function domainMatches(hostname, pattern) {
      if (!hostname || !pattern) return false;
      const hn = hostname.toLowerCase();
      const p = pattern.toLowerCase();

      // Exact match
      if (hn === p) return true;

      // Wildcard pattern: *.example.com matches example.com and any subdomain
      if (p.startsWith('*.')) {
        const base = p.slice(2);
        return hn === base || hn.endsWith('.' + base);
      }

      // Base domain pattern: example.com matches sub.example.com
      return hn.endsWith('.' + p);
    }

    let siteSetting = undefined;
    if (Array.isArray(siteSettings) && siteSettings.length > 0) {
      const hostname = currentTabUrl.hostname;
      const candidates = siteSettings.filter((s) => domainMatches(hostname, s.domain));
      // Prefer the most specific (longest) domain rule if multiple match
      siteSetting = candidates.sort((a, b) => (b.domain?.length || 0) - (a.domain?.length || 0))[0];
    }

    // Check if deduplication is disabled for this site (support time-based snooze)
    if (siteSetting) {
      const now = Date.now();
      const disabledUntil = typeof siteSetting.disabledUntil === 'number' ? siteSetting.disabledUntil : 0;
      const isSnoozed = disabledUntil > now;
      const isDisabled = !!siteSetting.disabled || isSnoozed;
      if (isDisabled) {
        recentlyProcessedTabs.delete(tabId);
        return;
      }
      // Optional: clear expired snooze to keep storage clean
      if (disabledUntil && disabledUntil <= now) {
        try {
          const { siteSettings: latest } = await chrome.storage.sync.get('siteSettings');
          const arr = Array.isArray(latest) ? latest : [];
          const idx = arr.findIndex((s) => s.domain === siteSetting.domain);
          if (idx !== -1) {
            delete arr[idx].disabledUntil;
            await chrome.storage.sync.set({ siteSettings: arr });
          }
        } catch (_) {}
      }
    }

    // Build URL for comparison
    let urlToCompare = buildComparisonUrl(currentTabUrl, siteSetting);
    
    console.log('[MergeX Debug] Checking tab:', {
      url: url,
      hostname: currentTabUrl.hostname,
      siteSetting: siteSetting,
      urlToCompare: urlToCompare
    });

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
          console.log('[MergeX Debug] Found duplicate:', {
            current: urlToCompare,
            existing: existingTabUrlString,
            existingTabId: existingTab.id,
            willClose: tabId
          });
          
          // Focus existing tab and close new one
          try {
            await chrome.tabs.update(existingTab.id, { active: true });
            await chrome.windows.update(currentTab.windowId, { focused: true });
          } catch (_) {}

          await chrome.tabs.remove(tabId);
          // Clean up processing state for the closed tab
          recentlyProcessedTabs.delete(tabId);
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
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.sync.get(['preventDuplicates', 'siteSettings'], (result) => {
    // Always ensure the global flag has a sane default
    if (result.preventDuplicates === undefined) {
      chrome.storage.sync.set({ preventDuplicates: true });
    }

    // Only reset site settings on first install to avoid wiping user config on update
    if (details?.reason === 'install') {
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
