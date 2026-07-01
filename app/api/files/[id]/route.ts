import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, FILES_BUCKET } from "@/lib/supabase-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, content } = body as { name?: string; content?: string };

  const { data: row, error: rowError } = await supabaseAdmin
    .from("project_files")
    .select("*")
    .eq("id", id)
    .single();

  if (rowError || !row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (typeof content === "string") {
    const { error: uploadError } = await supabaseAdmin.storage
      .from(FILES_BUCKET)
      .upload(row.storage_path, new Blob([content], { type: "text/plain" }), {
        upsert: true,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof content === "string") updates.size_bytes = new Blob([content]).size;

  const { data, error: updateError } = await supabaseAdmin
    .from("project_files")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: row, error: rowError } = await supabaseAdmin
    .from("project_files")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (rowError || !row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await supabaseAdmin.storage.from(FILES_BUCKET).remove([row.storage_path]);

  const { error: deleteError } = await supabaseAdmin
    .from("project_files")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}