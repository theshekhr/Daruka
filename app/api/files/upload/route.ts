import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, FILES_BUCKET, getFileType } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("project_id") as string | null;
  const userId = (formData.get("user_id") as string | null) || "anonymous";

  if (!file || !projectId) {
    return NextResponse.json({ error: "file and project_id are required" }, { status: 400 });
  }

  const fileType = getFileType(file.name);
  const fileId = crypto.randomUUID();
  const storagePath = `${userId}/${projectId}/${fileId}-${file.name}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(FILES_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("project_files")
    .insert({
      id: fileId,
      project_id: projectId,
      user_id: userId,
      name: file.name,
      storage_path: storagePath,
      file_type: fileType,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}