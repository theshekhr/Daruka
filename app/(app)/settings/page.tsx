"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { user } = useAuth();

  // ── Gemini key state ──
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [keySuccess, setKeySuccess] = useState("");

  // ── Extension token state ──
  const [tokenLoading, setTokenLoading] = useState(true);
  const [existingToken, setExistingToken] = useState<string | null>(null); // masked
  const [generatedToken, setGeneratedToken] = useState<string | null>(null); // full, shown once
  const [tokenGenerating, setTokenGenerating] = useState(false);
  const [tokenRevoking, setTokenRevoking] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenError, setTokenError] = useState("");

  // ── Load both on mount ──
  useEffect(() => {
    loadGeminiKey();
    loadExtensionToken();
  }, []);

  async function loadGeminiKey() {
    try {
      const data = await apiGet("/api/settings");
      setHasKey(data.hasKey);
      setMaskedKey(data.maskedKey);
    } catch {
      // leave defaults
    } finally {
      setLoading(false);
    }
  }

  async function loadExtensionToken() {
    try {
      const data = await apiGet("/api/extension-token");
      setExistingToken(data.hasToken ? data.maskedToken : null);
    } catch {
      setExistingToken(null);
    } finally {
      setTokenLoading(false);
    }
  }

  // ── Gemini key handlers ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim()) return;
    setSaving(true);
    setKeyError("");
    setKeySuccess("");
    try {
      const data = await apiPost("/api/settings", { apiKey: newKey.trim() });
      setHasKey(data.hasKey);
      setMaskedKey(data.maskedKey);
      setNewKey("");
      setKeySuccess("API key saved and verified.");
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveKey() {
    if (!confirm("Remove your Gemini API key? AI features will stop working until you add a new one.")) return;
    setSaving(true);
    setKeyError("");
    setKeySuccess("");
    try {
      await apiDelete("/api/settings");
      setHasKey(false);
      setMaskedKey(null);
      setKeySuccess("API key removed.");
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Failed to remove key");
    } finally {
      setSaving(false);
    }
  }

  // ── Extension token handlers ──
  async function handleGenerateToken() {
    setTokenGenerating(true);
    setTokenError("");
    setGeneratedToken(null);
    try {
      const data = await apiPost("/api/extension-token", {});
      setGeneratedToken(data.token); // full token shown once
      setExistingToken(data.maskedToken);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setTokenGenerating(false);
    }
  }

  async function handleRevokeToken() {
    if (!confirm("Revoke this token? The Chrome extension will be disconnected immediately.")) return;
    setTokenRevoking(true);
    setTokenError("");
    try {
      await apiDelete("/api/extension-token");
      setExistingToken(null);
      setGeneratedToken(null);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Failed to revoke token");
    } finally {
      setTokenRevoking(false);
    }
  }

  async function handleCopyToken() {
    if (!generatedToken) return;
    await navigator.clipboard.writeText(generatedToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-[15px] font-semibold text-[var(--text)]">Settings</h1>
        <p className="mt-0.5 text-[12px] text-[var(--text3)]">
          Manage your account and AI provider keys
        </p>
      </div>

      <div className="mx-auto max-w-xl px-6 py-6 flex flex-col gap-5">

        {/* ── ACCOUNT ── */}
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] p-5">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--bg4)] text-[13px] font-semibold text-[var(--text)]">
                {(user?.displayName || user?.email || "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[14px] font-medium text-[var(--text)]">
                {user?.displayName || "Account"}
              </p>
              <p className="text-[12px] text-[var(--text3)]">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* ── GEMINI API KEY ── */}
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] p-5">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">Gemini API key</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text2)]">
            ContextOS uses your own Google Gemini API key to extract knowledge from conversations
            and generate context documents. Your key is encrypted before storage and never shared.{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text)] underline"
            >
              Get a free key from Google AI Studio →
            </a>
          </p>

          {loading ? (
            <p className="mt-4 text-[12px] text-[var(--text3)]">Loading...</p>
          ) : (
            <>
              {hasKey && (
                <div className="mt-4 flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: "var(--green)" }} />
                    <span className="font-mono text-[12px] text-[var(--text2)]">{maskedKey}</span>
                  </div>
                  <button
                    onClick={handleRemoveKey}
                    disabled={saving}
                    className="text-[12px] text-[var(--red)] hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              )}

              <form onSubmit={handleSave} className="mt-4 flex flex-col gap-2.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                  {hasKey ? "Replace key" : "Add your API key"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="AIza..."
                    className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 font-mono text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--border2)]"
                  />
                  <button
                    type="submit"
                    disabled={saving || !newKey.trim()}
                    className="flex-shrink-0 rounded-md bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Testing..." : "Save & test"}
                  </button>
                </div>
                {keyError && <p className="text-[12px] text-[var(--red)]">{keyError}</p>}
                {keySuccess && <p className="text-[12px]" style={{ color: "var(--green)" }}>{keySuccess}</p>}
              </form>
            </>
          )}
        </div>

        {/* ── EXTENSION TOKEN ── */}
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] p-5">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">Chrome extension token</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text2)]">
            Generate a long-lived token to connect the ContextOS Chrome extension to your account.
            Paste it into the extension once — it never expires unless you revoke it.
          </p>

          {tokenLoading ? (
            <p className="mt-4 text-[12px] text-[var(--text3)]">Loading...</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">

              {/* Show existing token (masked) */}
              {existingToken && !generatedToken && (
                <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: "var(--green)" }} />
                    <span className="font-mono text-[12px] text-[var(--text2)]">{existingToken}</span>
                  </div>
                  <span className="text-[11px] text-[var(--text3)]">Active</span>
                </div>
              )}

              {/* Show newly generated token — one time only */}
              {generatedToken && (
                <div className="rounded-md border border-[var(--border2)] bg-[var(--bg3)] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                      Your token — copy it now, it won&apos;t be shown again
                    </span>
                    <button
                      onClick={handleCopyToken}
                      className="text-[11px] font-medium text-[var(--text)] underline hover:no-underline"
                    >
                      {tokenCopied ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <div
                    className="cursor-pointer rounded border border-[var(--border)] bg-[var(--bg4)] px-3 py-2 font-mono text-[11px] text-[var(--text2)] break-all select-all"
                    onClick={handleCopyToken}
                  >
                    {generatedToken}
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--text3)]">
                    Paste this into the ContextOS Chrome extension → &quot;Connect your account&quot;
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateToken}
                  disabled={tokenGenerating}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
                >
                  {tokenGenerating
                    ? "Generating..."
                    : existingToken
                    ? "Regenerate token"
                    : "Generate token"}
                </button>
                {existingToken && (
                  <button
                    onClick={handleRevokeToken}
                    disabled={tokenRevoking}
                    className="rounded-md border border-[var(--border)] px-4 py-2 text-[12px] font-medium text-[var(--red)] hover:bg-[var(--bg3)] disabled:opacity-50"
                  >
                    {tokenRevoking ? "Revoking..." : "Revoke"}
                  </button>
                )}
              </div>

              {tokenError && (
                <p className="text-[12px] text-[var(--red)]">{tokenError}</p>
              )}

              {/* How to use */}
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">
                  How to connect the extension
                </p>
                <ol className="flex flex-col gap-1.5">
                  {[
                    "Download and install the ContextOS Chrome extension",
                    "Click the extension icon while on ChatGPT or Claude",
                    'Paste your token into the "Extension token" field',
                    "Click Connect — you're done",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-[var(--text2)]">
                      <span className="font-mono text-[var(--text3)] flex-shrink-0">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}