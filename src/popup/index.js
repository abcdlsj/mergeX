import './index.css'

document.addEventListener('DOMContentLoaded', async () => {
  const appElement = document.getElementById('app')
  
  // Create main element
  const mainElement = document.createElement('main')
  
  // Create title
  const h3Element = document.createElement('h3')
  h3Element.textContent = 'Tab Management'
  
  // Create button container
  const buttonContainer = document.createElement('div')
  buttonContainer.className = 'button-container'
  
  // Merge button
  const mergeButton = document.createElement('button')
  mergeButton.textContent = 'Merge Tabs'
  mergeButton.className = 'action-button merge'
  mergeButton.title = 'Merge tabs from all windows and remove duplicates'
  
  // Sort button
  const sortButton = document.createElement('button')
  sortButton.textContent = 'Sort by Domain'
  sortButton.className = 'action-button sort'
  sortButton.title = 'Sort tabs by domain name'
  
  // Group buttons
  const groupByTimeButton = document.createElement('button')
  groupByTimeButton.textContent = 'Group by Time'
  groupByTimeButton.className = 'action-button clean'
  groupByTimeButton.title = 'Group tabs by last access time'
  
  const groupByDomainButton = document.createElement('button')
  groupByDomainButton.textContent = 'Group by Domain'
  groupByDomainButton.className = 'action-button clean'
  groupByDomainButton.title = 'Group tabs by domain name'
  
  // Ungroup button
  const ungroupButton = document.createElement('button')
  ungroupButton.textContent = 'Ungroup All'
  ungroupButton.className = 'action-button ungroup'
  ungroupButton.title = 'Remove all tab groups'
  
  // 排序功能
  sortButton.addEventListener('click', async () => {
    try {
      // 获取当前窗口的所有标签
      const currentWindow = await chrome.windows.getCurrent()
      const tabs = await chrome.tabs.query({ windowId: currentWindow.id })
      
      // 提取域名并创建排序数组
      const tabsWithDomain = tabs.map(tab => {
        let domain = ''
        try {
          const url = new URL(tab.url)
          domain = url.hostname
        } catch (e) {
          domain = tab.url || ''
        }
        return { tab, domain }
      })
      
      // 按域名排序
      tabsWithDomain.sort((a, b) => {
        // 保持固定标签页在最前
        if (a.tab.pinned !== b.tab.pinned) {
          return a.tab.pinned ? -1 : 1
        }
        return a.domain.localeCompare(b.domain)
      })
      
      // 移动标签页到新位置
      for (let i = 0; i < tabsWithDomain.length; i++) {
        await chrome.tabs.move(tabsWithDomain[i].tab.id, { index: i })
      }
      
      // 显示成功标记
      await chrome.action.setBadgeText({ text: '✓' })
      await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
      
    } catch (error) {
      console.error('排序标签页时出错:', error)
      await chrome.action.setBadgeText({ text: '×' })
      await chrome.action.setBadgeBackgroundColor({ color: '#F44336' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
    }
  })

  // 合并标签页的功能
  mergeButton.addEventListener('click', async () => {
    try {
      // 获取所有窗口
      const windows = await chrome.windows.getAll({ populate: true })
      
      // 获取当前窗口
      const currentWindow = await chrome.windows.getCurrent()
      
      // 用于存储已见过的URL
      const seenUrls = new Map() // Map<url, tabId>
      const tabsToRemove = new Set()
      
      // 处理当前窗口的标签页
      const currentTabs = windows.find(w => w.id === currentWindow.id)?.tabs || []
      for (const tab of currentTabs) {
        if (!tab.url || tab.pinned) continue // 跳过空URL和固定标签页
        
        if (seenUrls.has(tab.url)) {
          tabsToRemove.add(tab.id)
        } else {
          seenUrls.set(tab.url, tab.id)
        }
      }
      
      // 如果有多个窗口，处理其他窗口的标签页
      if (windows.length > 1) {
        for (const window of windows) {
          if (window.id === currentWindow.id) continue
          
          try {
            if (window.tabs) {
              // 收集源窗口的分组信息
              const groupMetaById = {}
              try {
                const groups = await chrome.tabGroups.query({ windowId: window.id })
                for (const g of groups) {
                  groupMetaById[g.id] = { title: g.title, color: g.color, collapsed: g.collapsed }
                }
              } catch (_) {}

              const ungroupedToMove = []
              const groupedToMove = new Map() // Map<groupId, tabIds[]>

              for (const tab of window.tabs) {
                if (tab.pinned) {
                  // 固定标签直接移动
                  ungroupedToMove.push(tab.id)
                  continue
                }
                if (!tab.url) {
                  ungroupedToMove.push(tab.id)
                  continue
                }

                if (seenUrls.has(tab.url)) {
                  tabsToRemove.add(tab.id)
                  continue
                }
                seenUrls.set(tab.url, tab.id)

                if (tab.groupId && tab.groupId !== chrome.tabs.TAB_ID_NONE) {
                  if (!groupedToMove.has(tab.groupId)) groupedToMove.set(tab.groupId, [])
                  groupedToMove.get(tab.groupId).push(tab.id)
                } else {
                  ungroupedToMove.push(tab.id)
                }
              }

              const allToMove = [...ungroupedToMove, ...[...groupedToMove.values()].flat()]
              if (allToMove.length > 0) {
                await chrome.tabs.move(allToMove, { windowId: currentWindow.id, index: -1 })
              }

              // 在目标窗口重建分组
              for (const [groupId, tabIds] of groupedToMove) {
                if (!tabIds || tabIds.length === 0) continue
                try {
                  const newGroupId = await chrome.tabs.group({ tabIds })
                  const meta = groupMetaById[groupId]
                  if (meta) {
                    await chrome.tabGroups.update(newGroupId, meta)
                  }
                } catch (_) {}
              }
            }
            
            // 关闭已经移空的窗口
            await chrome.windows.remove(window.id)
          } catch (moveError) {
            console.warn(`处理窗口 ${window.id} 失败:`, moveError)
          }
        }
      }
      
      // 删除重复的标签页
      if (tabsToRemove.size > 0) {
        await chrome.tabs.remove([...tabsToRemove])
        
        // 显示成功标记，包含去重数量
        const badge = `${tabsToRemove.size}`
        await chrome.action.setBadgeText({ text: badge })
        await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' })
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
      } else {
        // 如果没有重复标签，显示对勾
        await chrome.action.setBadgeText({ text: '✓' })
        await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' })
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
      }
      
    } catch (error) {
      console.error('合并标签页时出错:', error)
      await chrome.action.setBadgeText({ text: '×' })
      await chrome.action.setBadgeBackgroundColor({ color: '#F44336' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
    }
  })

  // 按时间分组的处理函数
  groupByTimeButton.addEventListener('click', async () => {
    try {
      const currentWindow = await chrome.windows.getCurrent()
      const tabs = await chrome.tabs.query({ windowId: currentWindow.id })
      
      const now = Date.now()
      const tabsWithTime = await Promise.all(tabs.map(async tab => {
        return {
          tab,
          lastAccessed: tab.lastAccessed || 0
        }
      }))
      
      // 按最后访问时间分组
      const recent = [] // < 1 day
      const older = [] // > 1 day
      const oldest = [] // > 3 days
      
      tabsWithTime.forEach(({ tab, lastAccessed }) => {
        if (tab.pinned || tab.active) return // 跳过固定和当前标签
        
        const hoursSinceAccess = (now - lastAccessed) / (1000 * 60 * 60)
        
        if (hoursSinceAccess < 24) {
          recent.push(tab)
        } else if (hoursSinceAccess < 72) {
          older.push(tab)
        } else {
          oldest.push(tab)
        }
      })
      
      // 创建标签组
      if (older.length > 0) {
        const olderGroup = await chrome.tabs.group({
          tabIds: older.map(tab => tab.id)
        })
        await chrome.tabGroups.update(olderGroup, {
          title: '> 1 day',
          color: 'yellow'
        })
      }
      
      if (oldest.length > 0) {
        const oldestGroup = await chrome.tabs.group({
          tabIds: oldest.map(tab => tab.id)
        })
        await chrome.tabGroups.update(oldestGroup, {
          title: '> 3 days',
          color: 'grey'
        })
      }
      
      // 显示处理的标签数量
      const processedCount = older.length + oldest.length
      await chrome.action.setBadgeText({ text: `${processedCount}` })
      await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
      
    } catch (error) {
      console.error('分组标签页时出错:', error)
      await chrome.action.setBadgeText({ text: '×' })
      await chrome.action.setBadgeBackgroundColor({ color: '#F44336' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
    }
  })

  // 按域名分组的处理函数
  groupByDomainButton.addEventListener('click', async () => {
    try {
      const currentWindow = await chrome.windows.getCurrent()
      const tabs = await chrome.tabs.query({ windowId: currentWindow.id })
      
      // 提取域名并创建分组映射
      const domainGroups = new Map() // Map<domain, tabIds[]>
      const usedColors = new Set() // 追踪已使用的颜色
      
      tabs.forEach(tab => {
        if (tab.pinned || tab.active) return // 跳过固定和当前标签
        
        let domain = ''
        try {
          const url = new URL(tab.url)
          domain = url.hostname
        } catch (e) {
          domain = tab.url || ''
        }
        
        if (!domainGroups.has(domain)) {
          domainGroups.set(domain, [])
        }
        domainGroups.get(domain).push(tab.id)
      })
      
      // 为每个域名创建标签组
      let processedCount = 0
      for (const [_, tabIds] of domainGroups) {
        if (tabIds.length > 1) { // 只为多个标签创建分组
          const group = await chrome.tabs.group({ tabIds })
          const color = getNextColor(usedColors)
          await chrome.tabGroups.update(group, {
            color: color
          })
          processedCount += tabIds.length
        }
      }
      
      // 显示处理的标签数量
      await chrome.action.setBadgeText({ text: `${processedCount}` })
      await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
      
    } catch (error) {
      console.error('分组标签页时出错:', error)
      await chrome.action.setBadgeText({ text: '×' })
      await chrome.action.setBadgeBackgroundColor({ color: '#F44336' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
    }
  })

  // 获取下一个可用颜色
  function getNextColor(usedColors) {
    const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']
    
    // 找到第一个未使用的颜色
    const availableColor = colors.find(color => !usedColors.has(color))
    
    if (availableColor) {
      usedColors.add(availableColor)
      return availableColor
    }
    
    // 如果所有颜色都被使用了，清空使用记录并从头开始
    usedColors.clear()
    usedColors.add(colors[0])
    return colors[0]
  }

  // 解除分组按钮
  ungroupButton.addEventListener('click', async () => {
    try {
      const currentWindow = await chrome.windows.getCurrent()
      const tabs = await chrome.tabs.query({ windowId: currentWindow.id })
      
      // 找出所有在分组中的标签
      const groupedTabs = tabs.filter(tab => tab.groupId !== chrome.tabs.TAB_ID_NONE)
      
      if (groupedTabs.length > 0) {
        // 解除所有标签的分组
        await chrome.tabs.ungroup(groupedTabs.map(tab => tab.id))
        
        // 显示处理的标签数量
        await chrome.action.setBadgeText({ text: `${groupedTabs.length}` })
        await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' })
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
      } else {
        // 如果没有分组的标签
        await chrome.action.setBadgeText({ text: '0' })
        await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' })
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
      }
    } catch (error) {
      console.error('解除分组时出错:', error)
      await chrome.action.setBadgeText({ text: '×' })
      await chrome.action.setBadgeBackgroundColor({ color: '#F44336' })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000)
    }
  })
  
  // 快捷设置区域：防重复、保护当前链接、忽略查询参数
  const quickSettings = document.createElement('div')
  quickSettings.className = 'quick-settings'

  const preventRow = document.createElement('label')
  preventRow.className = 'qs-row'
  const preventCheckbox = document.createElement('input')
  preventCheckbox.type = 'checkbox'
  const preventSpan = document.createElement('span')
  preventSpan.textContent = 'Prevent duplicate tabs'
  preventRow.appendChild(preventCheckbox)
  preventRow.appendChild(preventSpan)

  const protectRow = document.createElement('label')
  protectRow.className = 'qs-row'
  const protectCheckbox = document.createElement('input')
  protectCheckbox.type = 'checkbox'
  const protectSpan = document.createElement('span')
  protectSpan.textContent = 'Protect this URL'
  protectRow.appendChild(protectCheckbox)
  protectRow.appendChild(protectSpan)

  const ignoreQueryRow = document.createElement('label')
  ignoreQueryRow.className = 'qs-row'
  const ignoreQueryCheckbox = document.createElement('input')
  ignoreQueryCheckbox.type = 'checkbox'
  const ignoreQuerySpan = document.createElement('span')
  ignoreQuerySpan.textContent = 'Ignore query when matching'
  ignoreQueryRow.appendChild(ignoreQueryCheckbox)
  ignoreQueryRow.appendChild(ignoreQuerySpan)

  quickSettings.appendChild(preventRow)
  quickSettings.appendChild(protectRow)
  quickSettings.appendChild(ignoreQueryRow)

  // 读取并初始化开关状态
  const [{ preventDuplicates, siteSettings }, [activeTab]] = await Promise.all([
    chrome.storage.sync.get(['preventDuplicates', 'siteSettings']),
    chrome.tabs.query({ active: true, currentWindow: true })
  ])

  const getDomainKey = (urlStr) => {
    try {
      const u = new URL(urlStr)
      return u.hostname + u.pathname
    } catch {
      return ''
    }
  }

  const domainKey = activeTab?.url ? getDomainKey(activeTab.url) : ''
  let sites = Array.isArray(siteSettings) ? [...siteSettings] : []
  preventCheckbox.checked = !!preventDuplicates
  const existingIdx = sites.findIndex(s => s.domain === domainKey)
  const isProtected = existingIdx !== -1
  protectCheckbox.checked = isProtected
  ignoreQueryCheckbox.checked = isProtected ? !!sites[existingIdx].ignoreQuery : false
  ignoreQueryCheckbox.disabled = !protectCheckbox.checked

  preventCheckbox.addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ preventDuplicates: e.target.checked })
  })

  protectCheckbox.addEventListener('change', async (e) => {
    if (!domainKey) return
    // Lazily refresh sites
    const res = await chrome.storage.sync.get('siteSettings')
    sites = Array.isArray(res.siteSettings) ? res.siteSettings : []
    const idx = sites.findIndex(s => s.domain === domainKey)
    if (e.target.checked) {
      if (idx === -1) {
        sites.push({ domain: domainKey, ignoreQuery: !!ignoreQueryCheckbox.checked })
      }
      ignoreQueryCheckbox.disabled = false
    } else {
      if (idx !== -1) {
        sites.splice(idx, 1)
      }
      ignoreQueryCheckbox.disabled = true
    }
    await chrome.storage.sync.set({ siteSettings: sites })
  })

  ignoreQueryCheckbox.addEventListener('change', async (e) => {
    if (!domainKey) return
    const res = await chrome.storage.sync.get('siteSettings')
    sites = Array.isArray(res.siteSettings) ? res.siteSettings : []
    let idx = sites.findIndex(s => s.domain === domainKey)
    if (idx === -1) {
      // Auto-protect if toggled
      protectCheckbox.checked = true
      sites.push({ domain: domainKey, ignoreQuery: !!e.target.checked })
    } else {
      sites[idx].ignoreQuery = !!e.target.checked
    }
    await chrome.storage.sync.set({ siteSettings: sites })
  })

  // 修改按钮添加顺序
  buttonContainer.appendChild(mergeButton)
  buttonContainer.appendChild(sortButton)
  buttonContainer.appendChild(groupByTimeButton)
  buttonContainer.appendChild(groupByDomainButton)
  buttonContainer.appendChild(ungroupButton)

  // Create settings button
  const settingsButton = document.createElement('button')
  settingsButton.textContent = 'Settings'
  settingsButton.className = 'action-button settings'
  settingsButton.title = 'Open extension settings'
  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
  })
  
  // Add elements to page
  mainElement.appendChild(h3Element)
  mainElement.appendChild(buttonContainer)
  mainElement.appendChild(quickSettings)
  mainElement.appendChild(settingsButton)
  appElement.appendChild(mainElement)
  
  // Show success message when popup opens
  chrome.action.setBadgeText({ text: '' })
})
