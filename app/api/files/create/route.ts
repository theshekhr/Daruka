import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, FILES_BUCKET, getFileType } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { project_id, name, user_id, folder_id } = body as {
    project_id?: string;
    name?: string;
    user_id?: string;
    folder_id?: string | null;
  };

  if (!project_id || !name || !name.trim()) {
    return NextResponse.json({ error: "project_id and name are required" }, { status: 400 });
  }

  const uid = user_id || "anonymous";
  const fileType = getFileType(name);
  const fileId = crypto.randomUUID();
  const storagePath = `${uid}/${project_id}/${fileId}-${name.trim()}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(FILES_BUCKET)
    .upload(storagePath, new Blob([""], { type: "text/plain" }), {
      contentType: "text/plain",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("project_files")
    .insert({
      id: fileId,
      project_id,
      user_id: uid,
      name: name.trim(),
      storage_path: storagePath,
      file_type: fileType,
      mime_type: "text/plain",
      size_bytes: 0,
      folder_id: folder_id || null,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}