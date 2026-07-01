import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, FILES_BUCKET } from "@/lib/supabase-admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: row, error: rowError } = await supabaseAdmin
    .from("project_files")
    .select("*")
    .eq("id", id)
    .single();

  if (rowError || !row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (row.file_type === "code" || row.file_type === "text") {
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from(FILES_BUCKET)
      .download(row.storage_path);

    if (downloadError || !blob) {
      return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
    }

    const content = await blob.text();
    return NextResponse.json({ ...row, content });
  }

  // image / pdf / other: return a signed URL instead of raw bytes
  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(FILES_BUCKET)
    .createSignedUrl(row.storage_path, 60 * 60);

  if (signError || !signed) {
    return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
  }

  return NextResponse.json({ ...row, url: signed.signedUrl });
}