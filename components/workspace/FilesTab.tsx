"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api-client";
import ConfirmDialog from "@/components/workspace/ConfirmDialog";

type FileItem = {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  storage_path: string;
  file_type: "code" | "image" | "pdf" | "text" | "other";
  mime_type: string | null;
  size_bytes: number;
  folder_id: string | null;
  synced_from_memory_id: string | null;
  created_at: string;
  updated_at: string;
};

type FolderItem = {
  id: string;
  project_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
};

const GROUP_LABELS: Record<string, string> = {
  code: "Code",
  image: "Images",
  pdf: "PDFs",
  text: "Text",
  other: "Other",
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

type SharedProps = {
  files: FileItem[];
  folders: FolderItem[];
  selectedId: string | null;
  expandedFolders: Set<string>;
  renamingId: string | null;
  renameValue: string;
  renamingFolderId: string | null;
  renameFolderValue: string;
  newFolderParentId: string | null | undefined;
  newFolderName: string;
  newFileParentId: string | null | undefined;
  newFileName: string;
  onOpenFile: (f: FileItem) => void;
  onToggleFolder: (id: string) => void;
  onStartRenameFile: (f: FileItem) => void;
  onRenameValueChange: (v: string) => void;
  onCommitRenameFile: (f: FileItem) => void;
  onAskDeleteFile: (f: FileItem) => void;
  onStartRenameFolder: (f: FolderItem) => void;
  onRenameFolderValueChange: (v: string) => void;
  onCommitRenameFolder: (f: FolderItem) => void;
  onAskDeleteFolder: (f: FolderItem) => void;
  onStartNewFolder: (parentId: string | null) => void;
  onNewFolderNameChange: (v: string) => void;
  onCommitNewFolder: (parentId: string | null) => void;
  onCancelNewFolder: () => void;
  onStartNewFile: (folderId: string | null) => void;
  onNewFileNameChange: (v: string) => void;
  onCommitNewFile: (folderId: string | null) => void;
};

function FileRow({
  file,
  depth,
  shared,
}: {
  file: FileItem;
  depth: number;
  shared: SharedProps;
}) {
  const isRenaming = shared.renamingId === file.id;
  return (
    <div
      className={`group flex items-center justify-between py-1.5 pr-3 text-[12px] cursor-pointer ${
        shared.selectedId === file.id
          ? "bg-[var(--bg4)] text-[var(--text)]"
          : "text-[var(--text2)] hover:bg-[var(--bg3)]"
      }`}
      style={{ paddingLeft: `${12 + depth * 14}px` }}
      onClick={() => shared.onOpenFile(file)}
    >
      {isRenaming ? (
        <input
          autoFocus
          value={shared.renameValue}
          onChange={(e) => shared.onRenameValueChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => shared.onCommitRenameFile(file)}
          onKeyDown={(e) => e.key === "Enter" && shared.onCommitRenameFile(file)}
          className="flex-1 bg-[var(--bg3)] border border-[var(--border2)] rounded px-1 text-[12px] text-[var(--text)]"
        />
      ) : (
        <span className="truncate flex items-center gap-1">
          {file.name}
          {file.synced_from_memory_id && (
            <span className="text-[9px] text-[var(--text3)]" title="Auto-synced from a conversation">
              ⟳
            </span>
          )}
        </span>
      )}
      <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            shared.onStartRenameFile(file);
          }}
          className="text-[var(--text3)] hover:text-[var(--text)] text-[10px]"
        >
          Rename
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            shared.onAskDeleteFile(file);
          }}
          className="text-[var(--text3)] hover:text-red-400 text-[10px]"
        >
          Delete
        </span>
      </div>
    </div>
  );
}

function FolderRow({ folder, depth, shared }: { folder: FolderItem; depth: number; shared: SharedProps }) {
  const isExpanded = shared.expandedFolders.has(folder.id);
  const isRenaming = shared.renamingFolderId === folder.id;
  const childFolders = shared.folders.filter((f) => f.parent_folder_id === folder.id);
  const childFiles = shared.files.filter((f) => f.folder_id === folder.id);
  const isCreatingFolderHere = shared.newFolderParentId === folder.id;
  const isCreatingFileHere = shared.newFileParentId === folder.id;

  return (
    <div>
      <div
        className="group flex items-center justify-between py-1.5 pr-3 text-[12px] cursor-pointer text-[var(--text2)] hover:bg-[var(--bg3)]"
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => shared.onToggleFolder(folder.id)}
      >
        {isRenaming ? (
          <input
            autoFocus
            value={shared.renameFolderValue}
            onChange={(e) => shared.onRenameFolderValueChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => shared.onCommitRenameFolder(folder)}
            onKeyDown={(e) => e.key === "Enter" && shared.onCommitRenameFolder(folder)}
            className="flex-1 bg-[var(--bg3)] border border-[var(--border2)] rounded px-1 text-[12px] text-[var(--text)]"
          />
        ) : (
          <span className="flex items-center gap-1.5 truncate">
            <span className="text-[var(--text3)]">{isExpanded ? "▾" : "▸"}</span>
            {folder.name}
          </span>
        )}
        <div className="hidden group-hover:flex items-center gap-1.5 flex-shrink-0">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              shared.onStartNewFile(folder.id);
              if (!isExpanded) shared.onToggleFolder(folder.id);
            }}
            className="text-[var(--text3)] hover:text-[var(--text)] text-[10px]"
            title="New file in this folder"
          >
            +file
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              shared.onStartNewFolder(folder.id);
              if (!isExpanded) shared.onToggleFolder(folder.id);
            }}
            className="text-[var(--text3)] hover:text-[var(--text)] text-[10px]"
            title="New subfolder"
          >
            +folder
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              shared.onStartRenameFolder(folder);
            }}
            className="text-[var(--text3)] hover:text-[var(--text)] text-[10px]"
          >
            Rename
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              shared.onAskDeleteFolder(folder);
            }}
            className="text-[var(--text3)] hover:text-red-400 text-[10px]"
          >
            Delete
          </span>
        </div>
      </div>

      {isCreatingFolderHere && (
        <div className="py-1 pr-3" style={{ paddingLeft: `${12 + (depth + 1) * 14}px` }}>
          <input
            autoFocus
            value={shared.newFolderName}
            onChange={(e) => shared.onNewFolderNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") shared.onCommitNewFolder(folder.id);
              if (e.key === "Escape") shared.onCancelNewFolder();
            }}
            onBlur={() => shared.onCommitNewFolder(folder.id)}
            placeholder="folder name"
            className="w-full bg-[var(--bg3)] border border-[var(--border2)] rounded px-2 py-1 text-[11px] text-[var(--text)] outline-none"
          />
        </div>
      )}

      {isCreatingFileHere && (
        <div className="py-1 pr-3" style={{ paddingLeft: `${12 + (depth + 1) * 14}px` }}>
          <input
            autoFocus
            value={shared.newFileName}
            onChange={(e) => shared.onNewFileNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") shared.onCommitNewFile(folder.id);
              if (e.key === "Escape") shared.onStartNewFile(undefined as any);
            }}
            onBlur={() => shared.onCommitNewFile(folder.id)}
            placeholder="filename.ts"
            className="w-full bg-[var(--bg3)] border border-[var(--border2)] rounded px-2 py-1 text-[11px] text-[var(--text)] outline-none"
          />
        </div>
      )}

      {isExpanded && (
        <div>
          {childFolders.map((cf) => (
            <FolderRow key={cf.id} folder={cf} depth={depth + 1} shared={shared} />
          ))}
          {childFiles.map((f) => (
            <FileRow key={f.id} file={f} depth={depth + 1} shared={shared} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilesTab({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [content, setContent] = useState<string>("");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [oversizedFile, setOversizedFile] = useState<string | null>(null);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [newFileParentId, setNewFileParentId] = useState<string | null | undefined>(undefined);
  const [newFileName, setNewFileName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorHostRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<any>(null);
  const dragCounter = useRef(0);

  async function loadAll() {
    setLoading(true);
    try {
      const [filesData, foldersData] = await Promise.all([
        apiGet(`/api/files?project_id=${projectId}`),
        apiGet(`/api/folders?project_id=${projectId}`),
      ]);
      setFiles(filesData);
      setFolders(foldersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function openFile(file: FileItem) {
    setSelected(file);
    setSignedUrl(null);
    setContent("");
    setDirty(false);
    setContentLoading(true);
    try {
      const res = await fetch(`/api/files/${file.id}/content`);
      const data = await res.json();
      if (file.file_type === "code" || file.file_type === "text") {
        setContent(data.content ?? "");
      } else {
        setSignedUrl(data.url ?? null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setContentLoading(false);
    }
  }

  // Mount CodeMirror for code files
  useEffect(() => {
    let view: any = null;
    let cancelled = false;

    async function loadLanguage(filename: string) {
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      try {
        if (["js", "jsx", "ts", "tsx"].includes(ext)) {
          const m = await import("@codemirror/lang-javascript");
          return m.javascript({ jsx: ext.includes("x"), typescript: ext.startsWith("t") });
        }
        if (ext === "py") {
          const m = await import("@codemirror/lang-python");
          return m.python();
        }
        if (ext === "json") {
          const m = await import("@codemirror/lang-json");
          return m.json();
        }
        if (ext === "md") {
          const m = await import("@codemirror/lang-markdown");
          return m.markdown();
        }
        if (ext === "css") {
          const m = await import("@codemirror/lang-css");
          return m.css();
        }
        if (ext === "html") {
          const m = await import("@codemirror/lang-html");
          return m.html();
        }
      } catch {
        return null;
      }
      return null;
    }

    async function mount() {
      if (!selected || contentLoading) return;
      if (selected.file_type !== "code") return;
      if (!editorHostRef.current) return;

      const [
        { EditorView, basicSetup },
        { EditorState },
        { HighlightStyle, syntaxHighlighting },
        { tags: t },
        langExt,
      ] = await Promise.all([
        import("codemirror"),
        import("@codemirror/state"),
        import("@codemirror/language"),
        import("@lezer/highlight"),
        loadLanguage(selected.name),
      ]);

      if (cancelled || !editorHostRef.current) return;

      editorHostRef.current.innerHTML = "";

      const editorTheme = EditorView.theme(
        {
          "&": { backgroundColor: "transparent", color: "#c9d1d9", height: "100%" },
          ".cm-content": {
            caretColor: "#c9d1d9",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
            padding: "12px 0",
          },
          ".cm-gutters": { backgroundColor: "transparent", color: "#6e7681", border: "none" },
          ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#c9d1d9" },
          ".cm-activeLine": { backgroundColor: "rgba(110,118,129,0.1)" },
          "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
            backgroundColor: "rgba(56,139,253,0.3) !important",
          },
          ".cm-cursor": { borderLeftColor: "#c9d1d9" },
          "&.cm-focused": { outline: "none" },
          ".cm-lineNumbers .cm-gutterElement": { color: "#6e7681" },
        },
        { dark: true }
      );

      const editorHighlightStyle = HighlightStyle.define([
        { tag: t.keyword, color: "#ff7b72" },
        { tag: [t.name, t.deleted, t.character, t.macroName], color: "#c9d1d9" },
        { tag: [t.function(t.variableName), t.labelName], color: "#d2a8ff" },
        { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#79c0ff" },
        { tag: [t.definition(t.name), t.separator], color: "#ffa657" },
        {
          tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
          color: "#79c0ff",
        },
        {
          tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
          color: "#ff7b72",
        },
        { tag: [t.meta, t.comment], color: "#8b949e", fontStyle: "italic" },
        { tag: t.strong, fontWeight: "bold" },
        { tag: t.emphasis, fontStyle: "italic" },
        { tag: t.strikethrough, textDecoration: "line-through" },
        { tag: t.link, color: "#a5d6ff", textDecoration: "underline" },
        { tag: t.heading, fontWeight: "bold", color: "#79c0ff" },
        { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#79c0ff" },
        { tag: [t.processingInstruction, t.string, t.inserted], color: "#a5d6ff" },
        { tag: t.invalid, color: "#f85149" },
        { tag: t.tagName, color: "#7ee787" },
        { tag: t.attributeName, color: "#79c0ff" },
        { tag: t.variableName, color: "#ffa657" },
        { tag: t.propertyName, color: "#79c0ff" },
      ]);

      const extensions: any[] = [
        basicSetup,
        editorTheme,
        syntaxHighlighting(editorHighlightStyle),
        EditorView.updateListener.of((update: any) => {
          if (update.docChanged) {
            setContent(update.state.doc.toString());
            setDirty(true);
          }
        }),
      ];
      if (langExt) extensions.push(langExt);

      view = new EditorView({
        state: EditorState.create({ doc: content, extensions }),
        parent: editorHostRef.current,
      });
      editorViewRef.current = view;
    }

    mount();
    return () => {
      cancelled = true;
      if (view) view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, contentLoading]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/files/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const updated = await res.json();
      setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setSelected(updated);
      setDirty(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const tooLarge = incoming.find((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (tooLarge) {
      setOversizedFile(tooLarge.name);
      return;
    }
    setUploading(true);
    try {
      for (const file of incoming) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("project_id", projectId);
        formData.append("user_id", "anonymous");
        const res = await fetch("/api/files/upload", { method: "POST", body: formData });
        if (res.status === 413) {
          setOversizedFile(file.name);
          continue;
        }
      }
      await loadAll();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadInput(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    await uploadFiles(list);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1;
      setDragActive(true);
    }
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragActive(false);
    }
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    const list = e.dataTransfer.files;
    if (list && list.length > 0) await uploadFiles(list);
  }

  async function handleCreateFile(folderId: string | null) {
    const name = newFileName.trim();
    if (!name) {
      setNewFileParentId(undefined);
      return;
    }
    try {
      const res = await fetch("/api/files/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name, user_id: "anonymous", folder_id: folderId }),
      });
      const created = await res.json();
      setFiles((prev) => [...prev, created]);
      setNewFileParentId(undefined);
      setNewFileName("");
      openFile(created);
    } catch (err) {
      console.error(err);
      setNewFileParentId(undefined);
    }
  }

  function askDelete(file: FileItem) {
    setFileToDelete(file);
  }

  async function confirmDelete() {
    if (!fileToDelete) return;
    const file = fileToDelete;
    setFileToDelete(null);
    try {
      await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (selected?.id === file.id) {
        setSelected(null);
        setContent("");
        setSignedUrl(null);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function commitRename(file: FileItem) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === file.name) return;
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const updated = await res.json();
      setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      if (selected?.id === updated.id) setSelected(updated);
    } catch (err) {
      console.error(err);
    }
  }

  function toggleFolder(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function commitNewFolder(parentId: string | null) {
    const name = newFolderName.trim();
    setNewFolderParentId(undefined);
    if (!name) return;
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name, parent_folder_id: parentId }),
      });
      const created = await res.json();
      setFolders((prev) => [...prev, created]);
      setNewFolderName("");
    } catch (err) {
      console.error(err);
    }
  }

  async function commitRenameFolder(folder: FolderItem) {
    const name = renameFolderValue.trim();
    setRenamingFolderId(null);
    if (!name || name === folder.name) return;
    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const updated = await res.json();
      setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err) {
      console.error(err);
    }
  }

  async function confirmDeleteFolder() {
    if (!folderToDelete) return;
    const folder = folderToDelete;
    setFolderToDelete(null);
    try {
      await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
      await loadAll();
      if (selected?.folder_id === folder.id) {
        setSelected(null);
        setContent("");
        setSignedUrl(null);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const rootFiles = files.filter((f) => !f.folder_id);
  const rootFolders = folders.filter((f) => !f.parent_folder_id);
  const groupedRootFiles = rootFiles.reduce<Record<string, FileItem[]>>((acc, f) => {
    (acc[f.file_type] ||= []).push(f);
    return acc;
  }, {});

  const shared: SharedProps = {
    files,
    folders,
    selectedId: selected?.id ?? null,
    expandedFolders,
    renamingId,
    renameValue,
    renamingFolderId,
    renameFolderValue,
    newFolderParentId,
    newFolderName,
    newFileParentId,
    newFileName,
    onOpenFile: openFile,
    onToggleFolder: toggleFolder,
    onStartRenameFile: (f) => {
      setRenamingId(f.id);
      setRenameValue(f.name);
    },
    onRenameValueChange: setRenameValue,
    onCommitRenameFile: commitRename,
    onAskDeleteFile: askDelete,
    onStartRenameFolder: (f) => {
      setRenamingFolderId(f.id);
      setRenameFolderValue(f.name);
    },
    onRenameFolderValueChange: setRenameFolderValue,
    onCommitRenameFolder: commitRenameFolder,
    onAskDeleteFolder: (f) => setFolderToDelete(f),
    onStartNewFolder: (parentId) => {
      setNewFolderParentId(parentId);
      setNewFolderName("");
    },
    onNewFolderNameChange: setNewFolderName,
    onCommitNewFolder: commitNewFolder,
    onCancelNewFolder: () => setNewFolderParentId(undefined),
    onStartNewFile: (folderId) => {
      setNewFileParentId(folderId);
      setNewFileName("");
    },
    onNewFileNameChange: setNewFileName,
    onCommitNewFile: handleCreateFile,
  };

  return (
    <div
      className="relative flex h-full w-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-[var(--text)] bg-[var(--bg)]/80">
          <span className="text-[13px] font-medium text-[var(--text)]">Drop files to upload</span>
        </div>
      )}

      {/* File tree */}
      <div className="flex w-64 flex-shrink-0 flex-col border-r border-[var(--border)] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5 gap-1">
          <span className="text-[11px] font-medium text-[var(--text3)]">FILES</span>
          <div className="flex items-center gap-1">
            <button
              onClick={loadAll}
              title="Refresh (pick up newly synced files)"
              className="rounded-[4px] border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text2)] transition hover:border-[var(--border2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
            >
              ⟳
            </button>
            <button
              onClick={() => {
                setNewFolderParentId(null);
                setNewFolderName("");
              }}
              className="rounded-[4px] border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text2)] transition hover:border-[var(--border2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
            >
              + Folder
            </button>
            <button
              onClick={() => {
                setNewFileParentId(null);
                setNewFileName("");
              }}
              className="rounded-[4px] border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text2)] transition hover:border-[var(--border2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
            >
              + File
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-[4px] border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--text2)] transition hover:border-[var(--border2)] hover:bg-[var(--bg3)] hover:text-[var(--text)] disabled:opacity-50"
            >
              {uploading ? "..." : "↑"}
            </button>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUploadInput} />
        </div>

        {newFolderParentId === null && (
          <div className="border-b border-[var(--border)] px-3 py-2">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNewFolder(null);
                if (e.key === "Escape") setNewFolderParentId(undefined);
              }}
              onBlur={() => commitNewFolder(null)}
              placeholder="folder name"
              className="w-full bg-[var(--bg3)] border border-[var(--border2)] rounded px-2 py-1 text-[12px] text-[var(--text)] outline-none"
            />
          </div>
        )}

        {newFileParentId === null && (
          <div className="border-b border-[var(--border)] px-3 py-2">
            <input
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFile(null);
                if (e.key === "Escape") setNewFileParentId(undefined);
              }}
              onBlur={() => handleCreateFile(null)}
              placeholder="filename.ts"
              className="w-full bg-[var(--bg3)] border border-[var(--border2)] rounded px-2 py-1 text-[12px] text-[var(--text)] outline-none"
            />
          </div>
        )}

        {loading && <div className="px-3 py-3 text-[12px] text-[var(--text3)]">Loading files...</div>}

        {!loading && files.length === 0 && folders.length === 0 && newFileParentId === undefined && (
          <div className="px-3 py-3 text-[12px] text-[var(--text3)]">
            No files yet. Drag files here, use + File / + Folder, or fetch an AI conversation to auto-sync code.
          </div>
        )}

        {rootFolders.length > 0 && (
          <div className="py-1">
            {rootFolders.map((folder) => (
              <FolderRow key={folder.id} folder={folder} depth={0} shared={shared} />
            ))}
          </div>
        )}

        {Object.entries(groupedRootFiles).map(([type, items]) => (
          <div key={type} className="py-1">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)]">
              {GROUP_LABELS[type] || type}
            </div>
            {items.map((f) => (
              <FileRow key={f.id} file={f} depth={0} shared={shared} />
            ))}
          </div>
        ))}
      </div>

      {/* Viewer / editor */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selected && (
          <div className="flex h-full items-center justify-center text-[12px] text-[var(--text3)]">
            Select a file to view or edit, or drag files in to upload
          </div>
        )}

        {selected && (
          <>
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2">
              <span className="truncate text-[12px] font-medium text-[var(--text)]">
                {selected.name}
                {dirty && <span className="ml-1.5 text-[var(--text3)]">• unsaved</span>}
                {selected.synced_from_memory_id && (
                  <span className="ml-1.5 text-[var(--text3)]">• auto-synced</span>
                )}
              </span>
              {(selected.file_type === "code" || selected.file_type === "text") && (
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="rounded-[4px] border border-[var(--border2)] px-3 py-1 text-[11px] font-medium text-[var(--text)] transition hover:bg-[var(--bg3)] disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {contentLoading && <div className="p-4 text-[12px] text-[var(--text3)]">Loading...</div>}

              {!contentLoading && selected.file_type === "code" && (
                <div ref={editorHostRef} className="h-full text-[13px]" />
              )}

              {!contentLoading && selected.file_type === "text" && (
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setDirty(true);
                  }}
                  className="h-full w-full resize-none bg-transparent p-4 font-mono text-[12px] text-[var(--text)] outline-none"
                />
              )}

              {!contentLoading && selected.file_type === "image" && signedUrl && (
                <div className="flex h-full items-center justify-center p-4">
                  <img src={signedUrl} alt={selected.name} className="max-h-full max-w-full object-contain" />
                </div>
              )}

              {!contentLoading && selected.file_type === "pdf" && signedUrl && (
                <iframe src={signedUrl} className="h-full w-full" title={selected.name} />
              )}

              {!contentLoading && selected.file_type === "other" && (
                <div className="p-4 text-[12px] text-[var(--text3)]">
                  Preview not available for this file type.
                  {signedUrl && (
                    <a href={signedUrl} download className="ml-2 underline text-[var(--text)]">
                      Download
                    </a>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!fileToDelete}
        title="Delete file"
        message={`Are you sure you want to delete "${fileToDelete?.name}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setFileToDelete(null)}
      />

      <ConfirmDialog
        open={!!folderToDelete}
        title="Delete folder"
        message={`Delete "${folderToDelete?.name}" and everything inside it? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteFolder}
        onCancel={() => setFolderToDelete(null)}
      />

      <ConfirmDialog
        open={!!oversizedFile}
        title="File too large"
        message="Files bigger than 5MB are not allowed in this Beta version of the app."
        confirmLabel="OK"
        alertOnly
        onConfirm={() => setOversizedFile(null)}
        onCancel={() => setOversizedFile(null)}
      />
    </div>
  );
}