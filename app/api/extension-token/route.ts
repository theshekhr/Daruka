import { NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { createApiToken, revokeApiToken, getExistingToken } from "@/lib/api-tokens";

// This route is only ever called from the web app with a real Firebase ID token,
// never with an extension token, you can't mint a new token using an old one.
async function getUidFromFirebaseOnly(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing auth token");
  const token = authHeader.slice("Bearer ".length);
  const decoded = await verifyFirebaseToken(token);
  return decoded.uid;
}

// Checks whether the user already has an extension token, without exposing the real value.
export async function GET(request: Request) {
  try {
    const uid = await getUidFromFirebaseOnly(request);
    const existing = await getExistingToken(uid);

    return NextResponse.json({
      hasToken: !!existing,
      maskedToken: existing?.maskedToken ?? null,
      createdAt: existing?.createdAt ?? null,
      lastUsedAt: existing?.lastUsedAt ?? null,
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
    const uid = await getUidFromFirebaseOnly(request);
    const { token, maskedToken } = await createApiToken(uid);
    return NextResponse.json({ token, maskedToken });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const uid = await getUidFromFirebaseOnly(request);
    await revokeApiToken(uid);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}