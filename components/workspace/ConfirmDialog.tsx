"use client";

import { useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-[var(--border2)] bg-[var(--bg2)] p-5 shadow-2xl"
      >
        <h2 className="text-[14px] font-semibold text-[var(--text)]">{title}</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text2)]">{message}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text2)] transition hover:border-[var(--border2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-3.5 py-1.5 text-[12px] font-medium transition ${
              danger
                ? "bg-red-500/90 text-white hover:bg-red-500"
                : "bg-[var(--bg4)] text-[var(--text)] hover:bg-[var(--border2)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}