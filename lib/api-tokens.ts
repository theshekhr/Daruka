import crypto from "crypto";
import { createClient } from "./supabase";

const TOKEN_PREFIX = "ctxos_";

export function generateRawToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function previewOf(rawToken: string): string {
  const last4 = rawToken.slice(-4);
  return `${TOKEN_PREFIX}••••${last4}`;
}

export async function createApiToken(
  uid: string,
  label = "Browser extension"
): Promise<{ token: string; maskedToken: string }> {
  const supabase = createClient();
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const maskedToken = previewOf(rawToken);

  // Remove any existing token with the same label so there's only ever one active extension token
  await supabase.from("api_tokens").delete().eq("user_id", uid).eq("label", label);

  await supabase.from("api_tokens").insert({
    user_id: uid,
    token_hash: tokenHash,
    token_preview: maskedToken,
    label,
  });

  return { token: rawToken, maskedToken }; // raw token only ever returned once, at creation time
}

export async function getExistingToken(
  uid: string,
  label = "Browser extension"
): Promise<{ maskedToken: string; createdAt: string; lastUsedAt: string | null } | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("api_tokens")
    .select("token_preview, created_at, last_used_at")
    .eq("user_id", uid)
    .eq("label", label)
    .maybeSingle();

  if (!data) return null;

  return {
    maskedToken: data.token_preview,
    createdAt: data.created_at,
    lastUsedAt: data.last_used_at,
  };
}

export async function verifyApiToken(rawToken: string): Promise<string | null> {
  const supabase = createClient();
  const tokenHash = hashToken(rawToken);

  const { data } = await supabase
    .from("api_tokens")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data) return null;

  // Fire and forget, update last_used_at without blocking the request
  supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .then(() => {});

  return data.user_id;
}

export async function revokeApiToken(uid: string, label = "Browser extension"): Promise<void> {
  const supabase = createClient();
  await supabase.from("api_tokens").delete().eq("user_id", uid).eq("label", label);
}