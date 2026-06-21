(function () {
  const SITE = window.location.hostname.includes("claude.ai") ? "Claude" : "ChatGPT";

  function scrapeConversation() {
    let turns = [];

    if (SITE === "Claude") {
      const userSelectors = '[data-testid="user-message"], .font-user-message';
      const aiSelectors = '[data-testid="chat-message"], .font-claude-message';
      const combined = `${userSelectors}, ${aiSelectors}`;

      const nodes = document.querySelectorAll(combined);
      nodes.forEach((node) => {
        const isUser = node.matches(userSelectors);
        const text = node.innerText.trim();
        if (text) turns.push(`${isUser ? "User" : "Claude"}: ${text}`);
      });

      // Fallback: known selectors matched nothing (DOM structure has likely
      // changed). Grab the main conversation container's visible text instead
      // of giving up entirely.
      if (turns.length === 0) {
        const main =
          document.querySelector("main") ||
          document.querySelector('[role="main"]') ||
          document.body;
        const text = main.innerText.trim();
        if (text) turns.push(text);
      }
    } else {
      // ChatGPT renders each turn inside [data-message-author-role]
      const nodes = document.querySelectorAll("[data-message-author-role]");
      nodes.forEach((node) => {
        const role = node.getAttribute("data-message-author-role");
        const label = role === "user" ? "User" : "ChatGPT";
        const text = node.innerText.trim();
        if (text) turns.push(`${label}: ${text}`);
      });

      // Same fallback for ChatGPT in case its selector also goes stale later.
      if (turns.length === 0) {
        const main = document.querySelector("main") || document.body;
        const text = main.innerText.trim();
        if (text) turns.push(text);
      }
    }

    return turns.join("\n\n");
  }

  function createButton() {
    if (document.getElementById("contextos-float-btn")) return;
    const btn = document.createElement("button");
    btn.id = "contextos-float-btn";
    btn.innerHTML = `
      <span class="contextos-dot"></span>
      Add to Memory
    `;
    btn.addEventListener("click", handleClick);
    document.body.appendChild(btn);
  }

  function handleClick() {
    const conversation = scrapeConversation();
    if (!conversation || conversation.length < 10) {
      showToast("No conversation found on this page yet.");
      return;
    }
    chrome.runtime.sendMessage(
      { type: "CAPTURE_CONVERSATION", payload: { aiModel: SITE, conversation } },
      (response) => {
        if (response?.needsAuth) {
          showToast("Connect your ContextOS account in the extension popup first.");
        } else if (response?.needsProject) {
          showToast("Open the extension popup to pick a project, then click Add to Memory again.");
        }
      }
    );
  }

  function showToast(message) {
    let toast = document.getElementById("contextos-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "contextos-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
  }

  // Listen for messages from either the popup (project-picker flow) or the
  // background script (floating-button flow).
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // The popup asks for the page's conversation text and expects a reply.
    if (message.action === "scrapeConversation") {
      const text = scrapeConversation();
      sendResponse({ text });
      return; // synchronous reply, no need to keep the channel open
    }

    // Save results coming back from the background script (floating-button flow).
    if (message.type === "SAVE_SUCCESS") {
      showToast("Saved to ContextOS \u2713");
    } else if (message.type === "SAVE_ERROR") {
      showToast(message.error || "Failed to save.");
    }
  });

  createButton();

  // Some SPAs remove/replace the DOM on navigation; keep re-injecting the button
  const observer = new MutationObserver(() => createButton());
  observer.observe(document.body, { childList: true, subtree: true });
})();