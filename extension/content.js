(function () {
  const SITE = window.location.hostname.includes("claude.ai") ? "Claude" : "ChatGPT";

  function scrapeConversation() {
    let turns = [];

    if (SITE === "Claude") {
      const container = document.querySelector(
        ".flex-1.flex.flex-col.px-4.max-w-3xl.mx-auto.w-full.pt-1"
      );

      if (container) {
        Array.from(container.children).forEach((turn) => {
          const isUser = !!turn.querySelector(
            ".bg-bg-300.rounded-xl.break-words.text-text-100"
          );
          const text = turn.innerText.trim();
          if (text) turns.push(`${isUser ? "User" : "Claude"}: ${text}`);
        });
      }

      if (turns.length === 0) {
        const userSelectors = '[data-testid="user-message"], .font-user-message';
        const aiSelectors = '[data-testid="chat-message"], .font-claude-message';
        const nodes = document.querySelectorAll(`${userSelectors}, ${aiSelectors}`);
        nodes.forEach((node) => {
          const isUser = node.matches(userSelectors);
          const text = node.innerText.trim();
          if (text) turns.push(`${isUser ? "User" : "Claude"}: ${text}`);
        });
      }
    } else {
      const nodes = document.querySelectorAll("[data-message-author-role]");
      nodes.forEach((node) => {
        const role = node.getAttribute("data-message-author-role");
        const label = role === "user" ? "User" : "ChatGPT";
        const text = node.innerText.trim();
        if (text) turns.push(`${label}: ${text}`);
      });
    }

    return turns.join("\n");
  }

  function getButton() {
    return document.getElementById("contextos-float-btn");
  }

  function setButtonState(state, projectName) {
    const btn = getButton();
    if (!btn) return;

    if (state === "idle") {
      btn.innerHTML = `<span class="contextos-dot"></span> Add to Memory`;
      btn.disabled = false;
    } else if (state === "adding") {
      btn.innerHTML = `<span class="contextos-dot contextos-dot-pulse"></span> Adding to ${escapeHtml(projectName)}...`;
      btn.disabled = true;
    } else if (state === "added") {
      btn.innerHTML = `<span class="contextos-dot contextos-dot-success"></span> Added to ${escapeHtml(projectName)}`;
      btn.disabled = false;
      setTimeout(() => setButtonState("idle"), 2500);
    } else if (state === "error") {
      btn.innerHTML = `<span class="contextos-dot contextos-dot-error"></span> ${escapeHtml(projectName)}`;
      btn.disabled = false;
      setTimeout(() => setButtonState("idle"), 3500);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function createButton() {
    if (getButton()) return;

    const btn = document.createElement("button");
    btn.id = "contextos-float-btn";
    btn.innerHTML = `<span class="contextos-dot"></span> Add to Memory`;
    btn.addEventListener("click", handleClick);
    document.body.appendChild(btn);
  }

  async function handleClick() {
    // Read the currently active project directly from storage at click
    // time, so the button always reflects the real current selection
    // instead of any state borrowed from a separate popup instance.
    const { extensionToken, activeProjectId, activeProjectName } =
      await chrome.storage.local.get(["extensionToken", "activeProjectId", "activeProjectName"]);

    if (!extensionToken) {
      setButtonState("error", "Connect account in popup first");
      return;
    }

    if (!activeProjectId) {
      setButtonState("error", "Pick a project in popup first");
      return;
    }

    const conversation = scrapeConversation();
    if (!conversation || conversation.length < 10) {
      setButtonState("error", "No conversation found yet");
      return;
    }

    // Immediate feedback, before the network round-trip even starts
    setButtonState("adding", activeProjectName || "project");

    chrome.runtime.sendMessage(
      { type: "CAPTURE_CONVERSATION", payload: { aiModel: SITE, conversation } },
      () => {
        // Actual success/error state arrives asynchronously via the
        // SAVE_SUCCESS / SAVE_ERROR message listener below, since
        // background.js does the real work after this initial ack.
      }
    );
  }

  // Listen for messages from either the popup (project-picker flow) or the
  // background script (floating-button flow).
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "scrapeConversation") {
      const text = scrapeConversation();
      sendResponse({ text });
      return;
    }

    if (message.type === "SAVE_SUCCESS") {
      setButtonState("added", message.projectName || "project");
    } else if (message.type === "SAVE_ERROR") {
      setButtonState("error", message.error || "Failed to save");
    }
  });

  createButton();

  const observer = new MutationObserver(() => createButton());
  observer.observe(document.body, { childList: true, subtree: true });
})();