// ── CONFIG ──
const APP_URL = 'https://contextos-xi.vercel.app'

// AI site detection
const AI_SITES = {
  'chat.openai.com': { name: 'ChatGPT', color: '#10A37F' },
  'chatgpt.com':     { name: 'ChatGPT', color: '#10A37F' },
  'claude.ai':       { name: 'Claude',  color: '#D97757' },
}

// ── STATE ──
let selectedProjectId = null
let currentTab = null
let detectedAI = null
let savedProjectId = null

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  // Detect current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab = tab
  const hostname = new URL(tab.url).hostname
  detectedAI = AI_SITES[hostname] || null

  // Set site badge
  document.getElementById('site-badge').textContent = hostname

  // Check if on a supported site
  if (!detectedAI) {
    showScreen('unsupported')
    return
  }

  // Check if connected (token stored)
  const { extensionToken, userEmail } = await chrome.storage.local.get(['extensionToken', 'userEmail'])
  if (!extensionToken) {
    showScreen('connect')
    return
  }

  // Show loading while we verify token + load projects
  showScreen('loading')
  await loadMainScreen(extensionToken, userEmail)
})

// ── SCREEN MANAGEMENT ──
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(`screen-${name}`).classList.add('active')
}

function showStatus(elementId, type, message) {
  const el = document.getElementById(elementId)
  el.className = `status show ${type}`
  el.textContent = message
}

function hideStatus(elementId) {
  document.getElementById(elementId).className = 'status'
}

// ── CONNECT SCREEN ──
document.getElementById('connect-btn').addEventListener('click', async () => {
  const token = document.getElementById('token-input').value.trim()
  if (!token) {
    showStatus('connect-status', 'error', 'Please paste your extension token.')
    return
  }

  const btn = document.getElementById('connect-btn')
  btn.disabled = true
  btn.textContent = 'Verifying...'
  hideStatus('connect-status')

  try {
    // Verify token by fetching projects
    const res = await fetch(`${APP_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Invalid token')
    }

    const projects = await res.json()

    // Also get user email from the token info endpoint
    let email = 'Your account'
    try {
      const settingsRes = await fetch(`${APP_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        email = settings.email || email
      }
    } catch (_) {}

    // Store token + email
    await chrome.storage.local.set({ extensionToken: token, userEmail: email })
    showStatus('connect-status', 'success', 'Connected successfully!')

    setTimeout(async () => {
      showScreen('loading')
      await loadMainScreen(token, email)
    }, 800)

  } catch (err) {
    showStatus('connect-status', 'error', err.message || 'Connection failed. Check your token.')
    btn.disabled = false
    btn.textContent = 'Connect'
  }
})

// Allow Enter key to connect
document.getElementById('token-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('connect-btn').click()
})

// ── MAIN SCREEN ──
async function loadMainScreen(token, email) {
  try {
    // Set AI badge
    document.getElementById('ai-name').textContent = detectedAI.name
    document.getElementById('ai-dot').style.background = detectedAI.color

    // Set user info
    const initials = (email || '?').charAt(0).toUpperCase()
    document.getElementById('user-avatar').textContent = initials
    document.getElementById('user-email').textContent = email || 'Connected'

    // Fetch projects
    const res = await fetch(`${APP_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (res.status === 401) {
      // Token expired or revoked
      await chrome.storage.local.remove(['extensionToken', 'userEmail'])
      showScreen('connect')
      return
    }

    const projects = await res.json()

    // Render project list
    const list = document.getElementById('project-list')
    if (!projects || projects.length === 0) {
      list.innerHTML = '<div class="state-msg">No projects yet. Create one in ContextOS first.</div>'
    } else {
      list.innerHTML = ''
      projects.forEach(p => {
        const item = document.createElement('div')
        item.className = 'project-item'
        item.dataset.id = p.id
        item.dataset.name = p.name
        item.innerHTML = `
          <span class="project-dot"></span>
          <span class="project-name">${escapeHtml(p.name)}</span>
          <span class="project-memory-count" id="count-${p.id}">—</span>
        `
        item.addEventListener('click', () => selectProject(p.id, p.name))
        list.appendChild(item)
      })

      // Auto-select the first project
      if (projects.length > 0) {
        selectProject(projects[0].id, projects[0].name)
      }
    }

    showScreen('main')

  } catch (err) {
    document.getElementById('project-list').innerHTML =
      `<div class="state-msg">Failed to load projects.<br>${err.message}</div>`
    showScreen('main')
  }
}

function selectProject(id, name) {
  selectedProjectId = id

  // Update UI
  document.querySelectorAll('.project-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === id)
  })

  // Enable save button
  document.getElementById('save-btn').disabled = false
}

// ── SAVE BUTTON ──
document.getElementById('save-btn').addEventListener('click', async () => {
  if (!selectedProjectId) return

  const btn = document.getElementById('save-btn')
  btn.disabled = true
  btn.textContent = 'Capturing conversation...'
  hideStatus('save-status')

  const { extensionToken } = await chrome.storage.local.get('extensionToken')

  try {
    // Ask content script to scrape the conversation
    let scrapeResult
    try {
      scrapeResult = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'scrapeConversation',
        aiName: detectedAI.name
      })
    } catch (err) {
      throw new Error('Could not read the conversation. Make sure the page is fully loaded and try again.')
    }

    if (!scrapeResult || !scrapeResult.text) {
      throw new Error('No conversation found on this page. Start a conversation first.')
    }

    if (scrapeResult.text.length < 50) {
      throw new Error('Conversation is too short to save. Have a longer exchange first.')
    }

    btn.textContent = 'Extracting knowledge with AI...'

    // POST to your app's memories API
    const res = await fetch(`${APP_URL}/api/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`
      },
      body: JSON.stringify({
        project_id: selectedProjectId,
        ai_model: detectedAI.name,
        raw_conversation: scrapeResult.text
      })
    })

    if (res.status === 402) {
      showScreen('nokey')
      return
    }

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to save memory')
    }

    const memory = await res.json()
    savedProjectId = selectedProjectId

    // Show success screen
    const projectName = document.querySelector(`.project-item.selected .project-name`)?.textContent || 'your project'
    document.getElementById('success-project-name').textContent = `Added to "${projectName}"`

    // Show extracted category counts
    const pillsContainer = document.getElementById('extracted-pills')
    pillsContainer.innerHTML = ''
    const extracted = memory.extracted_data || {}
    const categories = [
      { key: 'decisions',     label: 'Decisions' },
      { key: 'features',      label: 'Features' },
      { key: 'bugs',          label: 'Bugs' },
      { key: 'bugfixes',      label: 'Bugfixes' },
      { key: 'code_snippets', label: 'Code' },
      { key: 'todos',         label: 'TODOs' },
      { key: 'ideas',         label: 'Ideas' },
      { key: 'architecture',  label: 'Architecture' },
    ]
    categories.forEach(cat => {
      const items = extracted[cat.key] || []
      const pill = document.createElement('span')
      pill.className = `extracted-pill${items.length > 0 ? ' has-data' : ''}`
      pill.textContent = items.length > 0 ? `${cat.label} · ${items.length}` : cat.label
      pillsContainer.appendChild(pill)
    })

    showScreen('success')

  } catch (err) {
    showStatus('save-status', 'error', err.message)
    btn.disabled = false
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 1v11M1 6.5h11"/></svg>
      Add to memory
    `
  }
})

// ── SUCCESS SCREEN ──
document.getElementById('view-btn').addEventListener('click', () => {
  if (savedProjectId) {
    chrome.tabs.create({ url: `${APP_URL}/project/${savedProjectId}` })
  } else {
    chrome.tabs.create({ url: `${APP_URL}/dashboard` })
  }
})

document.getElementById('save-another-btn').addEventListener('click', async () => {
  savedProjectId = null
  const { extensionToken, userEmail } = await chrome.storage.local.get(['extensionToken', 'userEmail'])
  showScreen('loading')
  await loadMainScreen(extensionToken, userEmail)
})

// ── NO KEY SCREEN ──
document.getElementById('settings-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: `${APP_URL}/settings` })
})

// ── DISCONNECT ──
document.getElementById('disconnect-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove(['extensionToken', 'userEmail'])
  selectedProjectId = null
  document.getElementById('token-input').value = ''
  hideStatus('connect-status')
  showScreen('connect')
})

// ── UTILS ──
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}