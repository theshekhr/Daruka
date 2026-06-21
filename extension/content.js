(function () {
  const SITE = window.location.hostname.includes("claude.ai") ? "Claude" : "ChatGPT";

  function scrapeConversation() {
    let turns = [];

    if (SITE === "Claude") {
      // Claude.ai renders messages inside elements with data-testid attributes
      // that vary by release; fall back gracefully across a couple of selectors.
      const nodes = document.querySelectorAll(
        '[data-testid="user-message"], [data-testid="chat-message"], .font-claude-message, .font-user-message'
      );
      nodes.forEach((node) => {
        const isUser =
          node.matches('[data-testid="user-message"]') || node.matches(".font-user-message");
        const text = node.innerText.trim();
        if (text) turns.push(`${isUser ? "User" : "Claude"}: ${text}`);
      });
    } else {
      // ChatGPT renders each turn inside [data-message-author-role]
      const nodes = document.querySelectorAll("[data-message-author-role]");
      nodes.forEach((node) => {
        const role = node.getAttribute("data-message-author-role");
        const label = role === "user" ? "User" : "ChatGPT";
        const text = node.innerText.trim();
        if (text) turns.push(`${label}: ${text}`);
      });
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

  // Listen for save results coming back from the background script
  chrome.runtime.onMessage.addListener((message) => {
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