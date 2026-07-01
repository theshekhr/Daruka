const API_BASE = "https://daruka.vercel.app";

async function getStoredAuth() {
  const data = await chrome.storage.local.get(["extensionToken", "activeProjectId", "activeProjectName"]);
  return {
    token: data.extensionToken || null,
    activeProjectId: data.activeProjectId || null,
    activeProjectName: data.activeProjectName || null,
  };
}

async function apiFetch(path, options = {}, tokenOverride = null) {
  const token = tokenOverride || (await getStoredAuth()).token;
  if (!token) throw new Error("NO_TOKEN");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return res.json();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_CONVERSATION") {
    handleCapture(message.payload, sender.tab?.id);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "FETCH_PROJECTS") {
    apiFetch("/api/projects")
      .then((projects) => sendResponse({ projects }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "TEST_TOKEN") {
    apiFetch("/api/projects")
      .then(() => sendResponse({ valid: true }))
      .catch(() => sendResponse({ valid: false }));
    return true;
  }

  if (message.type === "API_FETCH") {
    apiFetch(message.path, message.options || {})
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "API_POST") {
    apiFetch(message.path, {
      method: "POST",
      body: JSON.stringify(message.body),
    })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "VERIFY_TOKEN") {
    apiFetch(message.path || "/api/projects", {}, message.token)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleCapture(payload, tabId) {
  // Snapshot the active project at the moment the click happened, so if the
  // user switches projects in the popup mid-save, this save still completes
  // against the project that was active when they clicked.
  const { token, activeProjectId, activeProjectName } = await getStoredAuth();

  if (!token) {
    chrome.tabs.sendMessage(tabId, { type: "SAVE_ERROR", error: "Connect your account in the extension popup first." });
    return;
  }

  if (!activeProjectId) {
    chrome.tabs.sendMessage(tabId, { type: "SAVE_ERROR", error: "Open the extension popup and pick a project first." });
    return;
  }

  try {
    await apiFetch("/api/memories", {
      method: "POST",
      body: JSON.stringify({
        project_id: activeProjectId,
        ai_model: payload.aiModel,
        raw_conversation: payload.conversation,
      }),
    });
    chrome.tabs.sendMessage(tabId, { type: "SAVE_SUCCESS", projectName: activeProjectName });
  } catch (err) {
    chrome.tabs.sendMessage(tabId, { type: "SAVE_ERROR", error: err.message });
  }
}