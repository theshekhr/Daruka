"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { MemoryBlock } from "@/lib/types";

const AI_MODELS = ["ChatGPT", "Claude", "Gemini", "Grok", "DeepSeek", "Perplexity"];

export default function AddMemoryModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (memory: MemoryBlock) => void;
}) {
  const [aiModel, setAiModel] = useState(AI_MODELS[0]);
  const [conversation, setConversation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!conversation.trim()) return;
    setLoading(true);
    setError("");
    try {
      const memory = await apiPost("/api/memories", {
        project_id: projectId,
        ai_model: aiModel,
        raw_conversation: conversation.trim(),
      });
      onCreated(memory);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save memory");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[10px] border border-[var(--border2)] bg-[var(--bg2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 pb-4 pt-[18px]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Add memory manually</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text2)]">
              Paste a conversation. Daruka will extract decisions, features, bugs, and more.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-1 text-lg leading-none text-[var(--text3)] hover:text-[var(--text2)]"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-[18px]">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text3)]">
              AI model used
            </label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--border2)]"
            >
              {AI_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-1 flex-col">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text3)]">
              Conversation text
            </label>
            <textarea
              required
              value={conversation}
              onChange={(e) => setConversation(e.target.value)}
              placeholder="Paste the full conversation here..."
              rows={10}
              className="flex-1 resize-none rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--border2)]"
            />
          </div>

          {error && <p className="text-[12px] text-[var(--red)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[var(--accent)] py-2.5 text-[13px] font-semibold text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Extracting knowledge..." : "Save to memory"}
          </button>
        </form>
      </div>
    </div>
  );
}