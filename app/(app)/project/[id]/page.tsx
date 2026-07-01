"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import AILauncher from "@/components/workspace/AILauncher";
import Timeline from "@/components/workspace/Timeline";
import GraphView from "@/components/workspace/GraphView";
import ChatTab from "@/components/workspace/ChatTab";
import KnowledgePanel from "@/components/workspace/KnowledgePanel";
import ResizablePanel from "@/components/workspace/ResizablePanel";
import SwitchContextModal from "@/components/workspace/SwitchContextModal";
import AddMemoryModal from "@/components/workspace/AddMemoryModal";
import FilesTab from "@/components/workspace/FilesTab";
import type { Project, MemoryBlock, KnowledgeGraph } from "@/lib/types";

type ViewMode = "timeline" | "graph" | "chat" | "files";
export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [memories, setMemories] = useState<MemoryBlock[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSwitchContext, setShowSwitchContext] = useState(false);
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [view, setView] = useState<ViewMode>("timeline");

  async function loadKnowledge() {
    try {
      const data = await apiGet(`/api/knowledge?project_id=${id}`);
      setKnowledge(data);
    } catch {
      // No knowledge graph yet is fine, leave it null
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [projectData, memoriesData] = await Promise.all([
          apiGet(`/api/projects/${id}`),
          apiGet(`/api/memories?project_id=${id}`),
        ]);
        setProject(projectData);
        setMemories(memoriesData);
        await loadKnowledge();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleMemoryCreated(memory: MemoryBlock) {
    setMemories((prev) => [memory, ...prev]);
    loadKnowledge();
  }

  function handleMemoryDeleted(deletedId: string) {
    setMemories((prev) => prev.filter((m) => m.id !== deletedId));
    loadKnowledge();
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg)] text-[13px] text-[var(--text2)]">
        Loading workspace...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[var(--bg)] text-[13px] text-[var(--text2)]">
        <p>{error || "Project not found"}</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-[13px] text-[var(--text)] underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-[var(--text)]">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-0.5 truncate text-[11px] text-[var(--text3)]">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center rounded-md border border-[var(--border)] bg-[var(--bg3)] p-[3px]">
            <button
              onClick={() => setView("timeline")}
              className={`rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition ${
                view === "timeline" ? "bg-[var(--bg4)] text-[var(--text)]" : "text-[var(--text3)]"
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setView("graph")}
              className={`rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition ${
                view === "graph" ? "bg-[var(--bg4)] text-[var(--text)]" : "text-[var(--text3)]"
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setView("chat")}
              className={`rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition ${
                view === "chat" ? "bg-[var(--bg4)] text-[var(--text)]" : "text-[var(--text3)]"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setView("files")}
              className={`rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition ${
                view === "files" ? "bg-[var(--bg4)] text-[var(--text)]" : "text-[var(--text3)]"
              }`}
            >
              Files
            </button>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={() => setShowAddMemory(true)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-[6px] text-[12px] font-medium text-[var(--text2)] transition hover:border-[var(--border2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M7 1v12M1 7h12" />
              </svg>
              Add memory
            </button>
            <button
              onClick={() => setShowSwitchContext(true)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border2)] px-3 py-[6px] text-[12px] font-medium text-[var(--text)] transition hover:bg-[var(--bg3)]"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h10M2 7h7M2 10h4" />
                <circle cx="11" cy="9.5" r="2" strokeWidth="1.2" />
                <path d="M13 11.5l1 1" />
              </svg>
              Switch Context
            </button>
          </div>
        </div>

        {view === "timeline" && (
          <div className="flex-shrink-0 border-b border-[var(--border)] px-5 py-2.5">
            <AILauncher />
          </div>
        )}

        <div
          className={
            view === "timeline"
              ? "flex-1 overflow-y-auto px-5 py-4"
              : view === "chat"
              ? "flex-1 overflow-hidden"
              : "flex-1 overflow-hidden"
          }
        >
          {view === "timeline" && (
            <Timeline memories={memories} onMemoryDeleted={handleMemoryDeleted} />
          )}
          {view === "graph" && (
            <GraphView memories={memories} knowledge={knowledge?.data || null} />
          )}
          {view === "chat" && <ChatTab projectId={id} memories={memories} />}
          {view === "files" && <FilesTab projectId={id} />}
        </div>
      </div>

      <ResizablePanel defaultWidth={288} minWidth={220} maxWidth={480}>
        <KnowledgePanel data={knowledge?.data || null} memoryCount={memories.length} />
      </ResizablePanel>

      {showSwitchContext && (
        <SwitchContextModal projectId={id} onClose={() => setShowSwitchContext(false)} />
      )}

      {showAddMemory && (
        <AddMemoryModal
          projectId={id}
          onClose={() => setShowAddMemory(false)}
          onCreated={handleMemoryCreated}
        />
      )}
    </div>
  );
}