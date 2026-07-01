"use client";

import { useState } from "react";
import type { MemoryBlock as MemoryBlockType } from "@/lib/types";
import ConfirmDialog from "@/components/workspace/ConfirmDialog";

const CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  decisions: { label: "decision", bg: "rgba(255,255,255,0.04)", text: "#888888", border: "rgba(255,255,255,0.08)" },
  features: { label: "feature", bg: "rgba(255,255,255,0.04)", text: "#888888", border: "rgba(255,255,255,0.08)" },
  bugs: { label: "bug", bg: "rgba(245,101,101,0.08)", text: "#F56565", border: "rgba(245,101,101,0.15)" },
  bugfixes: { label: "bugfix", bg: "rgba(62,207,142,0.07)", text: "#3ECF8E", border: "rgba(62,207,142,0.12)" },
  code_snippets: { label: "code", bg: "rgba(255,255,255,0.04)", text: "#888888", border: "rgba(255,255,255,0.08)" },
  todos: { label: "todo", bg: "rgba(255,255,255,0.04)", text: "#888888", border: "rgba(255,255,255,0.08)" },
  ideas: { label: "idea", bg: "rgba(255,255,255,0.04)", text: "#888888", border: "rgba(255,255,255,0.08)" },
  research: { label: "research", bg: "rgba(255,255,255,0.04)", text: "#888888", border: "rgba(255,255,255,0.08)" },
  architecture: { label: "architecture", bg: "rgba(255,255,255,0.04)", text: "#888888", border: "rgba(255,255,255,0.08)" },
  questions: { label: "question", bg: "rgba(255,255,255,0.04)", text: "#888888", border: "rgba(255,255,255,0.08)" },
};

export default function MemoryBlock({
  memory,
  onDelete,
}: {
  memory: MemoryBlockType;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activeCategories = Object.entries(CATEGORY_STYLES).filter(
    ([key]) => memory.extracted_data?.[key as keyof typeof memory.extracted_data]?.length > 0
  );

  function requestDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      onDelete(memory.id);
    } finally {
      setDeleting(false);
    }
  }

  function toggleExpanded() {
    setExpanded((e) => !e);
  }

  function handleHeaderKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpanded();
    }
  }

  return (
    <div
      className={`rounded-[6px] border bg-[var(--bg2)] transition ${
        expanded ? "border-[var(--text3)]" : "border-[var(--border)] hover:border-[var(--border2)]"
      } ${deleting ? "opacity-40" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={handleHeaderKeyDown}
        className="flex w-full flex-col gap-2.5 p-4 text-left cursor-pointer"
      >
        <div className="flex items-start gap-2.5">
          <span
            className="flex-shrink-0 rounded-[4px] px-2 py-[3px] font-mono text-[10px] font-semibold"
            style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#666666" }}
          >
            {memory.ai_model}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-medium leading-snug text-[var(--text)]">
              {memory.title}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text2)]">
              {memory.summary}
            </p>
            <p className="mt-2 font-mono text-[10px] text-[var(--text3)]">
              {new Date(memory.created_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={requestDelete}
            disabled={deleting}
            className="flex-shrink-0 rounded-[4px] p-1.5 text-[var(--text3)] transition hover:bg-[var(--red)]/10 hover:text-[var(--red)]"
            title="Delete memory"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h12M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4M6.5 7.5v4M9.5 7.5v4M3.5 4l.5 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l.5-9" />
            </svg>
          </button>
        </div>

        {activeCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeCategories.map(([key, style]) => (
              <span
                key={key}
                className="rounded-[4px] border px-2 py-[2px] font-mono text-[10px] font-medium"
                style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
              >
                {style.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
            Extracted knowledge
          </p>
          {activeCategories.map(([key, style]) => {
            const items = memory.extracted_data[key as keyof typeof memory.extracted_data];
            return (
              <div key={key} className="border-b border-[var(--border)] py-1.5 last:border-none">
                <div className="flex gap-2">
                  <span
                    className="min-w-[70px] flex-shrink-0 pt-px font-mono text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: style.text }}
                  >
                    {style.label}
                  </span>
                  <div className="flex flex-col gap-1">
                    {items.map((item, i) => (
                      <span key={i} className="text-[12px] leading-relaxed text-[var(--text2)]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <p className="mb-2 mt-3.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
            Raw conversation
          </p>
          <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-[6px] border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text2)]">
            {memory.raw_conversation}
          </pre>
        </div>
      )}

      <button
        onClick={toggleExpanded}
        className="block w-full border-t border-[var(--border)] px-4 py-2 text-left text-[11px] text-[var(--text3)] hover:text-[var(--text2)]"
      >
        {expanded ? "▲ Collapse" : "▼ Show extracted knowledge & conversation"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete memory"
        message="Are you sure you want to delete this memory? This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}