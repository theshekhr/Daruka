(function () {
  const SITE = window.location.hostname.includes("claude.ai") ? "Claude" : "ChatGPT";

  // Turns a rendered <pre><code> block back into a proper markdown fence,
  // since innerText alone strips the backticks the site's markdown
  // originally had — without this, code blocks are invisible to any
  // downstream parser looking for ``` fences.
  function serializeCodeBlock(preEl) {
    const codeEl = preEl.querySelector("code") || preEl;
    const code = codeEl.innerText.replace(/\n+$/, "");

    // Try to detect a language from common class name conventions
    // (e.g. class="language-tsx" or "hljs language-python").
    let lang = "";
    const langMatch = (codeEl.className || "").match(/language-([\w+-]+)/);
    if (langMatch) lang = langMatch[1];

    // Best-effort filename detection: look for a small header/label
    // element near the code block that contains something that looks
    // like a filename (has a dot + short extension). Many AI UIs render
    // a filename chip directly above the <pre>.
    let filename = "";
    const candidates = [];

    // Check the element immediately before <pre> in the DOM
    let sibling = preEl.previousElementSibling;
    if (sibling) candidates.push(sibling.innerText?.trim());

    // Check a possible wrapping "code block card" header
    const wrapper = preEl.closest("div");
    if (wrapper) {
      const header = wrapper.querySelector(
        '[class*="header"], [class*="filename"], [class*="title"]'
      );
      if (header && header !== preEl) candidates.push(header.innerText?.trim());
    }

    const FILENAME_RE = /^[\w./-]+\.[a-zA-Z0-9]{1,10}$/;
    for (const c of candidates) {
      if (c && FILENAME_RE.test(c) && c.length < 100) {
        filename = c;
        break;
      }
    }

    const fenceInfo = filename ? `${lang}:${filename}` : lang;
    return "```" + fenceInfo + "\n" + code + "\n```";
  }

  // Serializes a message turn's DOM into text, preserving code blocks as
  // proper markdown fences instead of losing them to plain innerText.
  function serializeTurn(turnEl) {
    const clone = turnEl.cloneNode(true);
    const preBlocks = Array.from(turnEl.querySelectorAll("pre"));
    const clonedPreBlocks = Array.from(clone.querySelectorAll("pre"));

    clonedPreBlocks.forEach((clonedPre, i) => {
      const original = preBlocks[i];
      if (!original) return;
      const placeholder = document.createTextNode(
        `\n\n${serializeCodeBlock(original)}\n\n`
      );
      clonedPre.replaceWith(placeholder);
    });

    return clone.innerText.trim();
  }

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
          const text = serializeTurn(turn);
          if (text) turns.push(`${isUser ? "User" : "Claude"}: ${text}`);
        });
      }

      if (turns.length === 0) {
        const userSelectors = '[data-testid="user-message"], .font-user-message';
        const aiSelectors = '[data-testid="chat-message"], .font-claude-message';
        const nodes = document.querySelectorAll(`${userSelectors}, ${aiSelectors}`);
        nodes.forEach((node) => {
          const isUser = node.matches(userSelectors);
          const text = serializeTurn(node);
          if (text) turns.push(`${isUser ? "User" : "Claude"}: ${text}`);
        });
      }
    } else {
      const nodes = document.querySelectorAll("[data-message-author-role]");
      nodes.forEach((node) => {
        const role = node.getAttribute("data-message-author-role");
        const label = role === "user" ? "User" : "ChatGPT";
        const text = serializeTurn(node);
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

    setButtonState("adding", activeProjectName || "project");

    chrome.runtime.sendMessage(
      { type: "CAPTURE_CONVERSATION", payload: { aiModel: SITE, conversation } },
      () => {}
    );
  }

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