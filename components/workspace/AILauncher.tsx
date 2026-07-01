"use client";

const AI_TOOLS = [
  { name: "ChatGPT", url: "https://chat.openai.com", color: "#10A37F" },
  { name: "Claude", url: "https://claude.ai", color: "#E8865A" },
  { name: "Gemini", url: "https://gemini.google.com", color: "#4285F4" },
  { name: "Grok", url: "https://grok.com", color: "#888888" },
  { name: "DeepSeek", url: "https://chat.deepseek.com", color: "#4B9EFF" },
  { name: "Perplexity", url: "https://perplexity.ai", color: "#2DD4BF" },
];

export default function AILauncher() {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      <span className="mr-1 flex-shrink-0 text-[10px] font-medium uppercase tracking-wider text-[var(--text3)]">
        Open in
      </span>
      {AI_TOOLS.map((tool) => (
        <a
          key={tool.name}
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--bg2)] px-[11px] py-[5px] text-[11px] font-medium text-[var(--text2)] transition hover:border-[var(--border2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
        >
          <span
            className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
            style={{ backgroundColor: tool.color }}
          />
          {tool.name}
        </a>
      ))}
    </div>
  );
}


