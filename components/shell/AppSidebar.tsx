"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { signOutUser } from "@/lib/firebase-client";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type { Project } from "@/lib/types";

export default function AppSidebar() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [projects, setProjects] = useState<Project[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState<Project | null>(null);
  const [detailsName, setDetailsName] = useState("");
  const [detailsDesc, setDetailsDesc] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  async function loadProjects() {
    try {
      const data = await apiGet("/api/projects");
      setProjects(data);
    } catch {
      // silent fail in sidebar; dashboard page surfaces its own error
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    const project = await apiPost("/api/projects", {
      name: newName.trim(),
      description: newDesc.trim(),
    });
    setProjects((prev) => [project, ...prev]);
    setShowNewModal(false);
    setNewName("");
    setNewDesc("");
    router.push(`/project/${project.id}`);
  }

  function startQuickRename(project: Project) {
    setEditingId(project.id);
    setEditName(project.name);
    setMenuOpenId(null);
  }

  async function saveQuickRename(id: string) {
    if (!editName.trim()) return;
    const updated = await apiPatch(`/api/projects/${id}`, { name: editName.trim() });
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setEditingId(null);
  }

  function openDetailsModal(project: Project) {
    setShowDetailsModal(project);
    setDetailsName(project.name);
    setDetailsDesc(project.description || "");
    setMenuOpenId(null);
  }

  async function saveDetails() {
    if (!showDetailsModal || !detailsName.trim()) return;
    setSavingDetails(true);
    try {
      const updated = await apiPatch(`/api/projects/${showDetailsModal.id}`, {
        name: detailsName.trim(),
        description: detailsDesc.trim(),
      });
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setShowDetailsModal(null);
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project? This removes all its memories permanently.")) return;
    await apiDelete(`/api/projects/${id}`);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setMenuOpenId(null);
    if (params?.id === id) router.push("/dashboard");
  }

  async function handleLogout() {
    await signOutUser();
    router.push("/login");
  }

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Account";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className="flex h-full w-[216px] flex-shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--bg2)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3.5">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="text-sm font-semibold tracking-tight text-[var(--text)]">
            Daruka
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1.5">
        <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
          Projects
        </p>

        <div>
          {projects.map((project) => {
            const isActive = params?.id === project.id;
            const isEditing = editingId === project.id;

            return (
              <div key={project.id} className="group relative">
                {isEditing ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveQuickRename(project.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => saveQuickRename(project.id)}
                    className="w-full rounded-md border border-[var(--accent)] bg-[var(--bg3)] px-2.5 py-1.5 text-[13px] text-[var(--text)] outline-none"
                  />
                ) : (
                  // NOTE: this is a <div role="button"> rather than a real <button>
                  // because it contains a nested, independently-clickable "..." button
                  // for the project menu. Nesting <button> inside <button> is invalid
                  // HTML and causes a React hydration error.
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/project/${project.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") router.push(`/project/${project.id}`);
                    }}
                    className={`relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px] transition ${
                      isActive
                        ? "bg-[var(--bg3)] text-[var(--text)]"
                        : "text-[var(--text2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-r bg-[var(--text)]" />
                    )}
                    <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[var(--text3)]" />
                    <span className="flex-1 truncate text-left">{project.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === project.id ? null : project.id);
                      }}
                      className="rounded p-0.5 opacity-0 hover:bg-[var(--bg4)] group-hover:opacity-100"
                    >
                      <svg className="h-3.5 w-3.5 text-[var(--text3)]" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="8" cy="3" r="1.3" />
                        <circle cx="8" cy="8" r="1.3" />
                        <circle cx="8" cy="13" r="1.3" />
                      </svg>
                    </button>
                  </div>
                )}

                {menuOpenId === project.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-[var(--border2)] bg-[var(--bg3)] py-1 shadow-xl"
                  >
                    <button
                      onClick={() => startQuickRename(project)}
                      className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-[var(--text2)] hover:bg-[var(--bg4)] hover:text-[var(--text)]"
                    >
                      Quick rename
                    </button>
                    <button
                      onClick={() => openDetailsModal(project)}
                      className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-[var(--text2)] hover:bg-[var(--bg4)] hover:text-[var(--text)]"
                    >
                      Edit name & description
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-[var(--red)] hover:bg-[var(--bg4)]"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="mt-1.5 flex w-full items-center gap-1.5 rounded-md border border-dashed border-[var(--border2)] px-3 py-2 text-[12px] text-[var(--text3)] transition hover:border-[var(--text3)] hover:bg-[var(--bg3)] hover:text-[var(--text2)]"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
          New project
        </button>
      </div>

      <div className="relative border-t border-[var(--border)] p-3" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-md p-1 hover:bg-[var(--bg3)]"
        >
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt={displayName} className="h-7 w-7 rounded-full" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--bg4)] text-[11px] font-semibold text-[var(--text)]">
              {initials}
            </div>
          )}
          <div className="min-w-0 text-left">
            <p className="truncate text-[13px] font-medium text-[var(--text)]">{displayName}</p>
            <p className="text-[11px] text-[var(--text3)]">Free plan</p>
          </div>
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 z-20 mb-2 rounded-md border border-[var(--border2)] bg-[var(--bg3)] py-1 shadow-xl">
            <button
              onClick={() => {
                setUserMenuOpen(false);
                router.push("/settings");
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--bg4)]"
            >
              <span>Settings & API key</span>
            </button>
            <button
              onClick={toggleTheme}
              className="flex w-full items-center justify-between px-3 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--bg4)]"
            >
              <span>Appearance</span>
              <span className="rounded-full border border-[var(--border2)] px-2 py-0.5 text-[11px] text-[var(--text3)]">
                {theme === "dark" ? "Dark" : "Light"}
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center px-3 py-2 text-[13px] text-[var(--red)] hover:bg-[var(--bg4)]"
            >
              Log out
            </button>
          </div>
        )}
      </div>

      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-[460px] max-w-full rounded-[10px] border border-[var(--border2)] bg-[var(--bg2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-[18px]">
              <span className="text-[15px] font-semibold text-[var(--text)]">New project</span>
              <button
                onClick={() => setShowNewModal(false)}
                className="px-1 text-lg leading-none text-[var(--text3)] hover:text-[var(--text2)]"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-[18px]">
              <div className="mb-3.5">
                <label className="mb-1.5 block text-xs font-medium text-[var(--text2)]">
                  Project name
                </label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. OutPitch, My SaaS, Research 2025..."
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--border2)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text2)]">
                  Description
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What are you building or researching? (optional)"
                  rows={3}
                  className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-[13px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--border2)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-[18px]">
              <button
                onClick={() => setShowNewModal(false)}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--text2)] hover:bg-[var(--bg3)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--bg)] hover:opacity-90"
              >
                Create project
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
          onClick={() => setShowDetailsModal(null)}
        >
          <div
            className="w-[460px] max-w-full rounded-[10px] border border-[var(--border2)] bg-[var(--bg2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-[18px]">
              <span className="text-[15px] font-semibold text-[var(--text)]">Edit project</span>
              <button
                onClick={() => setShowDetailsModal(null)}
                className="px-1 text-lg leading-none text-[var(--text3)] hover:text-[var(--text2)]"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-[18px]">
              <div className="mb-3.5">
                <label className="mb-1.5 block text-xs font-medium text-[var(--text2)]">
                  Project name
                </label>
                <input
                  autoFocus
                  value={detailsName}
                  onChange={(e) => setDetailsName(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--border2)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text2)]">
                  Description
                </label>
                <textarea
                  value={detailsDesc}
                  onChange={(e) => setDetailsDesc(e.target.value)}
                  placeholder="What are you building or researching? (optional)"
                  rows={3}
                  className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-[13px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--border2)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-[18px]">
              <button
                onClick={() => setShowDetailsModal(null)}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--text2)] hover:bg-[var(--bg3)]"
              >
                Cancel
              </button>
              <button
                onClick={saveDetails}
                disabled={savingDetails || !detailsName.trim()}
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
              >
                {savingDetails ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}