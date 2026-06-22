import { createClient } from "./supabase";
import { decrypt } from "./crypto";
import type { UserProviderConfig } from "./providers";

export class NoApiKeyError extends Error {
  constructor() {
    super("No AI provider key found. Add one in Settings to use AI-powered extraction, or proceed with the rule-based fallback.");
    this.name = "NoApiKeyError";
  }
}

export async function getUserProviderConfig(uid: string): Promise<UserProviderConfig> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("encrypted_gemini_key, encrypted_groq_key, preferred_provider")
    .eq("user_id", uid)
    .maybeSingle();

  return {
    preferredProvider: (data?.preferred_provider as "gemini" | "groq") || "gemini",
    geminiKey: data?.encrypted_gemini_key ? decrypt(data.encrypted_gemini_key) : null,
    groqKey: data?.encrypted_groq_key ? decrypt(data.encrypted_groq_key) : null,
  };
}

// Kept for any code that still wants a single key directly (throws if none configured)
export async function getUserGeminiKey(uid: string): Promise<string> {
  const config = await getUserProviderConfig(uid);
  if (!config.geminiKey) throw new NoApiKeyError();
  return config.geminiKey;
}