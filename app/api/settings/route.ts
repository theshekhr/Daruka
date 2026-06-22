import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { encrypt, decrypt, maskKey } from "@/lib/crypto";
import { getProvider, type ProviderName } from "@/lib/providers";

async function getUid(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing auth token");
  const token = authHeader.split("Bearer ")[1];
  const decoded = await verifyFirebaseToken(token);
  return decoded.uid;
}

export async function GET(request: Request) {
  try {
    const uid = await getUid(request);
    const supabase = createClient();

    const { data } = await supabase
      .from("user_settings")
      .select("encrypted_gemini_key, encrypted_groq_key, preferred_provider")
      .eq("user_id", uid)
      .maybeSingle();

    return NextResponse.json({
      preferredProvider: data?.preferred_provider || "gemini",
      hasGeminiKey: !!data?.encrypted_gemini_key,
      maskedGeminiKey: data?.encrypted_gemini_key ? maskKey(decrypt(data.encrypted_gemini_key)) : null,
      hasGroqKey: !!data?.encrypted_groq_key,
      maskedGroqKey: data?.encrypted_groq_key ? maskKey(decrypt(data.encrypted_groq_key)) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const uid = await getUid(request);
    const body = await request.json();
    const providerName = body.provider as ProviderName | undefined;
    const apiKey = (body.apiKey || "").trim();

    if (!providerName || (providerName !== "gemini" && providerName !== "groq")) {
      return NextResponse.json({ error: "provider must be 'gemini' or 'groq'" }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    // Validate the key actually works before saving it
    try {
      const provider = getProvider(providerName);
      await provider.testKey(apiKey);
    } catch {
      return NextResponse.json(
        { error: `This ${providerName === "groq" ? "Groq" : "Gemini"} key didn't work. Double check it's correct and active.` },
        { status: 400 }
      );
    }

    const encrypted = encrypt(apiKey);
    const supabase = createClient();
    const columnName = providerName === "groq" ? "encrypted_groq_key" : "encrypted_gemini_key";

    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", uid)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_settings")
        .update({ [columnName]: encrypted, updated_at: new Date().toISOString() })
        .eq("user_id", uid);
    } else {
      await supabase.from("user_settings").insert({ user_id: uid, [columnName]: encrypted });
    }

    return NextResponse.json({ saved: true, provider: providerName, maskedKey: maskKey(apiKey) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function PATCH(request: Request) {
  // Used to update preferred_provider without touching keys
  try {
    const uid = await getUid(request);
    const body = await request.json();
    const providerName = body.preferredProvider as ProviderName | undefined;

    if (!providerName || (providerName !== "gemini" && providerName !== "groq")) {
      return NextResponse.json({ error: "preferredProvider must be 'gemini' or 'groq'" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", uid)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_settings")
        .update({ preferred_provider: providerName, updated_at: new Date().toISOString() })
        .eq("user_id", uid);
    } else {
      await supabase.from("user_settings").insert({ user_id: uid, preferred_provider: providerName });
    }

    return NextResponse.json({ preferredProvider: providerName });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const uid = await getUid(request);
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider"); // "gemini" | "groq" | null (null = remove both)

    const supabase = createClient();
    const updates: Record<string, null> = {};
    if (!provider || provider === "gemini") updates.encrypted_gemini_key = null;
    if (!provider || provider === "groq") updates.encrypted_groq_key = null;

    await supabase.from("user_settings").update(updates).eq("user_id", uid);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}