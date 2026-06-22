"use client";

import { useMemo, useState } from "react";
import MemoryBlock from "./MemoryBlock";
import type { MemoryBlock as MemoryBlockType } from "@/lib/types";

const FILTERS = [
  { key: "decisions", label: "Decisions" },
  { key: "bugs", label: "Bugs" },
  { key: "features", label: "Features" },
  { key: "code_snippets", label: "Code" },
] as const;

export default function Timeline({ memories }: { memories: MemoryBlockType[] }) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return memories.filter((m) => {
      if (activeFilter) {
        const items = m.extracted_data?.[activeFilter as keyof typeof m.extracted_data] || [];
        if (!items.length) return false;
      }
      if (search.trim()) {
        const haystack = `${m.title} ${m.summary} ${JSON.stringify(m.extracted_data)}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [memories, search, activeFilter]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-1.5">
        <input
          placeholder="Search memories, decisions, code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-[6px] text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--border2)]"
        />
        <button
          onClick={() => setActiveFilter(null)}
          className={`rounded-full border px-2.5 py-[4px] text-[11px] font-medium transition ${
            activeFilter === null
              ? "border-[var(--border2)] bg-[var(--bg4)] text-[var(--text)]"
              : "border-[var(--border)] text-[var(--text3)] hover:bg-[var(--bg4)] hover:text-[var(--text)]"
          }`}
        >
          All
        </button>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
            className={`rounded-full border px-2.5 py-[4px] text-[11px] font-medium transition ${
              activeFilter === f.key
                ? "border-[var(--border2)] bg-[var(--bg4)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text3)] hover:bg-[var(--bg4)] hover:text-[var(--text)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative ml-[9px] border-l border-[var(--border)] pl-[19px]">
        {filtered.length === 0 && (
          <p className="text-[13px] text-[var(--text3)]">
            {memories.length === 0
              ? "No memories yet. Use an AI tool above, then save the conversation with the Daruka extension."
              : "No memories match your search or filter."}
          </p>
        )}

        <div className="flex flex-col gap-5">
          {filtered.map((memory, idx) => (
            <div key={memory.id} className="relative">
              <span
                className={`absolute -left-[27px] top-[18px] h-2 w-2 rounded-full border ${
                  idx === 0
                    ? "border-[var(--text2)] bg-[var(--bg3)]"
                    : "border-[var(--border2)] bg-[var(--bg)]"
                }`}
              />
              <MemoryBlock memory={memory} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}