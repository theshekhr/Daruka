const API_BASE = "https://contextos-xi.vercel.app";

async function getStoredAuth() {
  const data = await chrome.storage.local.get(["token", "activeProjectId"]);
  return { token: data.token || null, activeProjectId: data.activeProjectId || null };
}

async function apiFetch(path, options = {}) {
  const { token } = await getStoredAuth();
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
    return true; // keep the message channel open for the async response
  }

  if (message.type === "TEST_TOKEN") {
    apiFetch("/api/projects")
      .then(() => sendResponse({ valid: true }))
      .catch(() => sendResponse({ valid: false }));
    return true;
  }
});

async function handleCapture(payload, tabId) {
  const { token, activeProjectId } = await getStoredAuth();

  if (!token) {
    chrome.tabs.sendMessage(tabId, { type: "SAVE_ERROR", error: "Connect your account in the extension popup first." });
    return;
  }

  if (!activeProjectId) {
    chrome.tabs.sendMessage(tabId, { type: "SAVE_ERROR", error: "Pick a project in the extension popup first." });
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
    chrome.tabs.sendMessage(tabId, { type: "SAVE_SUCCESS" });
  } catch (err) {
    chrome.tabs.sendMessage(tabId, { type: "SAVE_ERROR", error: err.message });
  }
}