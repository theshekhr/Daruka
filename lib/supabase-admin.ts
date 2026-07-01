import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const FILES_BUCKET = "project-files";

const CODE_EXT = ["js", "jsx", "ts", "tsx", "py", "json", "md", "css", "html", "yml", "yaml", "sh", "sql"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

export function getFileType(filename: string): "code" | "image" | "pdf" | "text" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXT.includes(ext)) return "image";
  if (CODE_EXT.includes(ext)) return "code";
  if (["txt", "csv", "log"].includes(ext)) return "text";
  return "other";
}