import { verifyFirebaseToken } from "./firebase-admin";
import { verifyApiToken } from "./api-tokens";

const EXTENSION_TOKEN_PREFIX = "ctxos_";

// Resolves a request's Authorization header to a Firebase UID,
// whether it's a short-lived Firebase ID token (web app) or a
// long-lived extension token (browser extension).
export async function resolveUid(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing auth token");
  }

  const token = authHeader.slice("Bearer ".length);

  if (token.startsWith(EXTENSION_TOKEN_PREFIX)) {
    const uid = await verifyApiToken(token);
    if (!uid) throw new Error("Invalid or revoked extension token");
    return uid;
  }

  const decoded = await verifyFirebaseToken(token);
  return decoded.uid;
}