"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type ProviderName = "gemini" | "groq";

export default function SettingsPage() {
  const { user } = useAuth();

  const [preferredProvider, setPreferredProvider] = useState<ProviderName>("gemini");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState<string | null>(null);
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [maskedGroqKey, setMaskedGroqKey] = useState<string | null>(null);

  const [newGeminiKey, setNewGeminiKey] = useState("");
  const [newGroqKey, setNewGroqKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingGemini, setSavingGemini] = useState(false);
  const [savingGroq, setSavingGroq] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [extensionToken, setExtensionToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  async function load() {
    try {
      const data = await apiGet("/api/settings");
      setPreferredProvider(data.preferredProvider || "gemini");
      setHasGeminiKey(data.hasGeminiKey);
      setMaskedGeminiKey(data.maskedGeminiKey);
      setHasGroqKey(data.hasGroqKey);
      setMaskedGroqKey(data.maskedGroqKey);
    } catch {
      // leave defaults
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePreferredChange(provider: ProviderName) {
    setPreferredProvider(provider);
    try {
      await apiPatch("/api/settings", { preferredProvider: provider });
    } catch {
      // non-critical, silently ignore
    }
  }

  async function handleSaveKey(provider: ProviderName) {
    const key = provider === "groq" ? newGroqKey : newGeminiKey;
    if (!key.trim()) return;

    if (provider === "groq") setSavingGroq(true);
    else setSavingGemini(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiPost("/api/settings", { provider, apiKey: key.trim() });
      if (provider === "groq") {
        setHasGroqKey(true);
        setMaskedGroqKey(data.maskedKey);
        setNewGroqKey("");
      } else {
        setHasGeminiKey(true);
        setMaskedGeminiKey(data.maskedKey);
        setNewGeminiKey("");
      }
      setSuccess(`${provider === "groq" ? "Groq" : "Gemini"} key saved and verified.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSavingGemini(false);
      setSavingGroq(false);
    }
  }

  async function handleRemoveKey(provider: ProviderName) {
    if (!confirm(`Remove your ${provider === "groq" ? "Groq" : "Gemini"} key?`)) return;
    try {
      await apiDelete(`/api/settings?provider=${provider}`);
      if (provider === "groq") {
        setHasGroqKey(false);
        setMaskedGroqKey(null);
      } else {
        setHasGeminiKey(false);
        setMaskedGeminiKey(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove key");
    }
  }

  async function handleGenerateToken() {
    setGeneratingToken(true);
    try {
      const data = await apiPost("/api/extension-token", {});
      setExtensionToken(data.token);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setGeneratingToken(false);
    }
  }

  async function handleRevokeToken() {
    if (!confirm("Revoke the extension token? The browser extension will stop working until you generate a new one.")) return;
    try {
      await apiDelete("/api/extension-token");
      setExtensionToken(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke token");
    }
  }

  async function copyToken() {
    if (!extensionToken) return;
    await navigator.clipboard.writeText(extensionToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  const hasAnyKey = hasGeminiKey || hasGroqKey;

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-[15px] font-semibold text-[var(--text)]">Settings</h1>
        <p className="mt-0.5 text-[12px] text-[var(--text3)]">
          Manage your account, AI provider keys, and browser extension
        </p>
      </div>

      <div className="mx-auto max-w-xl px-6 py-6">
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

        <div className="mt-5 rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] p-5">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">AI providers</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text2)]">
            Add keys for one or both providers. Daruka tries your preferred provider first and
            automatically falls back to the other, then to a rule-based extractor, if a request
            fails or hits a rate limit \u2014 saving a memory never fails outright.
          </p>

          {loading ? (
            <p className="mt-4 text-[12px] text-[var(--text3)]">Loading...</p>
          ) : (
            <>
              {hasAnyKey && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                    Preferred provider
                  </label>
                  <div className="flex rounded-md border border-[var(--border)] bg-[var(--bg3)] p-1">
                    <button
                      onClick={() => handlePreferredChange("gemini")}
                      className={`flex-1 rounded-[5px] py-1.5 text-[12px] font-medium transition ${
                        preferredProvider === "gemini"
                          ? "bg-[var(--bg4)] text-[var(--text)]"
                          : "text-[var(--text3)]"
                      }`}
                    >
                      Gemini
                    </button>
                    <button
                      onClick={() => handlePreferredChange("groq")}
                      className={`flex-1 rounded-[5px] py-1.5 text-[12px] font-medium transition ${
                        preferredProvider === "groq"
                          ? "bg-[var(--bg4)] text-[var(--text)]"
                          : "text-[var(--text3)]"
                      }`}
                    >
                      Groq
                    </button>
                  </div>
                </div>
              )}

              {/* Gemini key */}
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-[var(--text)]">
                    Gemini API key
                  </label>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[var(--text3)] underline hover:text-[var(--text2)]"
                  >
                    Get a key
                  </a>
                </div>

                {hasGeminiKey && (
                  <div className="mt-2 flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: "var(--green)" }} />
                      <span className="font-mono text-[12px] text-[var(--text2)]">{maskedGeminiKey}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveKey("gemini")}
                      className="text-[12px] text-[var(--red)] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="mt-2 flex gap-2">
                  <input
                    type="password"
                    value={newGeminiKey}
                    onChange={(e) => setNewGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 font-mono text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--border2)]"
                  />
                  <button
                    onClick={() => handleSaveKey("gemini")}
                    disabled={savingGemini || !newGeminiKey.trim()}
                    className="flex-shrink-0 rounded-md bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
                  >
                    {savingGemini ? "Testing..." : hasGeminiKey ? "Replace" : "Save"}
                  </button>
                </div>
              </div>

              {/* Groq key */}
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-[var(--text)]">
                    Groq API key
                  </label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[var(--text3)] underline hover:text-[var(--text2)]"
                  >
                    Get a key
                  </a>
                </div>

                {hasGroqKey && (
                  <div className="mt-2 flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: "var(--green)" }} />
                      <span className="font-mono text-[12px] text-[var(--text2)]">{maskedGroqKey}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveKey("groq")}
                      className="text-[12px] text-[var(--red)] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="mt-2 flex gap-2">
                  <input
                    type="password"
                    value={newGroqKey}
                    onChange={(e) => setNewGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 font-mono text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--border2)]"
                  />
                  <button
                    onClick={() => handleSaveKey("groq")}
                    disabled={savingGroq || !newGroqKey.trim()}
                    className="flex-shrink-0 rounded-md bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
                  >
                    {savingGroq ? "Testing..." : hasGroqKey ? "Replace" : "Save"}
                  </button>
                </div>
              </div>

              {error && <p className="mt-3 text-[12px] text-[var(--red)]">{error}</p>}
              {success && <p className="mt-3 text-[12px]" style={{ color: "var(--green)" }}>{success}</p>}

              {!hasAnyKey && (
                <p className="mt-4 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--text3)]">
                  No keys added yet \u2014 Daruka will use rule-based extraction (no AI) until you add one.
                  It still works, just with simpler, keyword-based extraction instead of true understanding.
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-5 rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] p-5">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">Browser extension</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text2)]">
            Generate a token to connect the Daruka browser extension to your account. Paste it
            into the extension once \u2014 it stays valid until you revoke it here.
          </p>
          <a href="https://Daruka.web.app/extension.zip">Download Extension here (BETA)</a><br></br>

          {extensionToken ? (
            <div className="mt-4">
              <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2.5">
                <span className="flex-1 truncate font-mono text-[11px] text-[var(--text2)]">
                  {extensionToken}
                </span>
                <button
                  onClick={copyToken}
                  className="flex-shrink-0 rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--bg)] hover:opacity-90"
                >
                  {tokenCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-[var(--amber)]">
                Copy this now \u2014 it won&apos;t be shown again.
              </p>
              <button
                onClick={handleRevokeToken}
                className="mt-3 text-[12px] text-[var(--red)] hover:underline"
              >
                Revoke this token
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateToken}
              disabled={generatingToken}
              className="mt-4 rounded-md border border-[var(--border2)] px-3.5 py-2 text-[12px] font-medium text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
            >
              {generatingToken ? "Generating..." : "Generate extension token"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}