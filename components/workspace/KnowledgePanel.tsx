"use client";

import type { KnowledgeData } from "@/lib/types";

const SECTIONS: { key: keyof KnowledgeData; label: string; color: string }[] = [
  { key: "purpose", label: "Project purpose", color: "#555555" },
  { key: "tech_stack", label: "Tech stack", color: "#555555" },
  { key: "decisions", label: "Key decisions", color: "#555555" },
  { key: "completed", label: "Completed", color: "#3ECF8E" },
  { key: "pending", label: "Pending", color: "#555555" },
  { key: "blockers", label: "Blockers", color: "#F56565" },
];

const EMPTY: KnowledgeData = {
  purpose: [],
  tech_stack: [],
  decisions: [],
  completed: [],
  pending: [],
  blockers: [],
  ideas: [],
  architecture: [],
};

export default function KnowledgePanel({
  data,
  memoryCount,
}: {
  data: KnowledgeData | null;
  memoryCount: number;
}) {
  const knowledge = data || EMPTY;
  const totalFacts = Object.values(knowledge).reduce((sum, arr) => sum + arr.length, 0);
  const aiModelsUsed = 0; // computed upstream in real use; placeholder for now

  return (
    <div className="flex h-full flex-col border-l border-[var(--border)] bg-[var(--bg2)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--text)]">Living memory</h2>
          <p className="mt-0.5 text-[11px] text-[var(--text3)]">Auto-updating knowledge graph</p>
        </div>
        <span
          className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
          style={{
            backgroundColor: "var(--green)",
            boxShadow: "0 0 5px var(--green)",
            animation: "pulse-dot 2s ease-in-out infinite",
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        {totalFacts === 0 ? (
          <p className="px-2 py-2 text-[12px] leading-relaxed text-[var(--text3)]">
            Nothing here yet. As you save AI sessions, Daruka will build up the
            project&apos;s purpose, stack, decisions, and progress automatically.
          </p>
        ) : (
          SECTIONS.map((section) => {
            const items = knowledge[section.key];
            if (!items.length) return null;
            return (
              <div key={section.key} className="mb-3.5">
                <div className="flex items-center gap-1.5 rounded-[5px] px-2 py-[5px]">
                  <span
                    className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
                    style={{ backgroundColor: section.color }}
                  />
                  <span className="text-[11px] font-semibold tracking-wide text-[var(--text2)]">
                    {section.label}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-[var(--text3)]">
                    {items.length}
                  </span>
                </div>
                <div className="px-2 pb-1 pt-0.5">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 border-b border-[rgba(42,42,42,0.5)] py-1 last:border-none"
                    >
                      <span className="mt-[7px] h-[3px] w-[3px] flex-shrink-0 rounded-full bg-[var(--text3)]" />
                      <span className="text-[11px] leading-relaxed text-[var(--text3)]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--border)] p-3">
        <div className="rounded-[6px] bg-[var(--bg3)] px-2.5 py-2">
          <p className="font-mono text-[15px] font-medium text-[var(--text)]">{memoryCount}</p>
          <p className="mt-0.5 text-[10px] text-[var(--text3)]">Memory blocks</p>
        </div>
        <div className="rounded-[6px] bg-[var(--bg3)] px-2.5 py-2">
          <p className="font-mono text-[15px] font-medium text-[var(--text)]">{totalFacts}</p>
          <p className="mt-0.5 text-[10px] text-[var(--text3)]">Facts captured</p>
        </div>
      </div>
    </div>
  );
}