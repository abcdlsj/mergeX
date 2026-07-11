import './index.css'

const escapeHtml = (value = '') =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const normalizeDomain = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]

const isValidDomain = (value) => {
  const domain = value.startsWith('*.') ? value.slice(2) : value
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)
}

const getRules = async () => {
  const { siteSettings = [] } = await chrome.storage.sync.get('siteSettings')
  return Array.isArray(siteSettings) ? siteSettings : []
}

const saveRules = (rules) => chrome.storage.sync.set({ siteSettings: rules })

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app')
  app.innerHTML = `
    <header class="app-header">
      <div class="brand"><img src="/icons/logo.svg" alt="" /><strong>MergeX</strong><span>Preferences</span></div>
      <span class="build-label">TAB UTILITY</span>
    </header>

    <main class="settings-shell">
      <header class="page-heading">
        <p class="kicker">SETTINGS</p>
        <h1>Preferences</h1>
        <p>Duplicate tabs are handled automatically. Most people never need to change anything here.</p>
      </header>

      <section class="setting-section">
        <header class="section-label"><span>01</span><h2>Protection</h2></header>
        <div class="section-body">
          <div class="status-line">
            <span class="status-dot" aria-hidden="true"></span>
            <div><strong>Active in every window</strong><p>Opening an address that already exists takes you back to the original tab.</p></div>
            <span class="always-label">AUTOMATIC</span>
          </div>
        </div>
      </section>

      <section class="setting-section">
        <header class="section-label"><span>02</span><h2>Site rules</h2></header>
        <div class="section-body rules-section">
          <div class="section-intro">
            <p>Add an exception only when a site treats tracking parameters or page anchors as the same page.</p>
            <span id="ruleCount" class="rule-count"></span>
          </div>

          <form class="rule-form" id="ruleForm" novalidate>
            <label class="domain-field" for="domainInput"><span>Website</span>
              <input id="domainInput" autocomplete="off" spellcheck="false" placeholder="example.com or *.example.com" />
              <span class="field-error" id="domainError" aria-live="polite"></span>
            </label>
            <button class="add-button" type="submit">Add rule</button>
            <div class="check-options">
              <label><input type="checkbox" id="ignoreQuery" /><span><strong>Ignore parameters</strong><small>?utm_source, ?ref, and similar</small></span></label>
              <label><input type="checkbox" id="ignoreHash" /><span><strong>Ignore anchors</strong><small>#comments, #section, and similar</small></span></label>
            </div>
          </form>

          <div class="rule-list" id="ruleList"></div>
        </div>
      </section>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
    </main>
  `

  let rules = await getRules()
  const list = document.getElementById('ruleList')
  const count = document.getElementById('ruleCount')
  const toast = document.getElementById('toast')

  const showToast = (message) => {
    toast.textContent = message
    toast.classList.add('is-visible')
    setTimeout(() => toast.classList.remove('is-visible'), 2200)
  }

  const renderRules = () => {
    count.textContent = `${rules.length} ${rules.length === 1 ? 'rule' : 'rules'}`
    if (!rules.length) {
      list.innerHTML = `<div class="empty-state"><span>01</span><div><strong>No exceptions yet</strong><p>That is a good thing. The default behavior fits most websites.</p></div></div>`
      return
    }
    list.innerHTML = rules
      .map((rule, index) => {
        const snoozed = typeof rule.disabledUntil === 'number' && rule.disabledUntil > Date.now()
        const state = rule.disabled
          ? 'Paused'
          : snoozed
            ? `Paused until ${new Date(rule.disabledUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Active'
        return `
        <article class="rule-item" data-index="${index}">
          <div class="rule-main">
            <div class="rule-title"><code>${escapeHtml(rule.domain)}</code><span class="rule-state ${rule.disabled || snoozed ? 'is-paused' : ''}">${state}</span></div>
            <div class="rule-toggles">
              <label><input type="checkbox" data-field="ignoreQuery" ${rule.ignoreQuery ? 'checked' : ''} /> Ignore parameters</label>
              <label><input type="checkbox" data-field="ignoreHash" ${rule.ignoreHash ? 'checked' : ''} /> Ignore anchors</label>
            </div>
          </div>
          <div class="rule-actions">
            <button type="button" data-action="pause">${rule.disabled ? 'Resume' : 'Pause'}</button>
            <button class="remove" type="button" data-action="remove" aria-label="Remove ${escapeHtml(rule.domain)}">Remove</button>
          </div>
        </article>`
      })
      .join('')
  }

  renderRules()

  document.getElementById('ruleForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const input = document.getElementById('domainInput')
    const error = document.getElementById('domainError')
    const domain = normalizeDomain(input.value)
    if (!isValidDomain(domain)) {
      input.classList.add('is-invalid')
      error.textContent = 'Enter a domain such as example.com'
      input.focus()
      return
    }
    input.classList.remove('is-invalid')
    error.textContent = ''
    const nextRule = {
      domain,
      ignoreQuery: document.getElementById('ignoreQuery').checked,
      ignoreHash: document.getElementById('ignoreHash').checked,
    }
    const existing = rules.findIndex((rule) => rule.domain === domain)
    if (existing === -1) rules.push(nextRule)
    else rules[existing] = { ...rules[existing], ...nextRule }
    await saveRules(rules)
    event.target.reset()
    renderRules()
    showToast(existing === -1 ? 'Site rule added' : 'Site rule updated')
  })

  list.addEventListener('change', async (event) => {
    const input = event.target.closest('input[data-field]')
    const item = event.target.closest('.rule-item')
    if (!input || !item) return
    const index = Number(item.dataset.index)
    rules[index] = { ...rules[index], [input.dataset.field]: input.checked }
    await saveRules(rules)
    showToast('Rule updated')
  })

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]')
    const item = event.target.closest('.rule-item')
    if (!button || !item) return
    const index = Number(item.dataset.index)
    if (button.dataset.action === 'remove') {
      const [removed] = rules.splice(index, 1)
      await saveRules(rules)
      renderRules()
      showToast(`${removed.domain} removed`)
    } else if (button.dataset.action === 'pause') {
      rules[index] = { ...rules[index], disabled: !rules[index].disabled }
      delete rules[index].disabledUntil
      await saveRules(rules)
      renderRules()
      showToast(rules[index].disabled ? 'Protection paused for this site' : 'Protection resumed')
    }
  })
})
