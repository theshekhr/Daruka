import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, FILES_BUCKET } from "@/lib/supabase-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name } = body as { name?: string };
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("project_folders")
    .update({ name: name.trim() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

async function collectFolderIds(rootId: string): Promise<string[]> {
  const all = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const { data: children } = await supabaseAdmin
      .from("project_folders")
      .select("id")
      .in("parent_folder_id", frontier);
    if (!children || children.length === 0) break;
    const ids = children.map((c) => c.id);
    all.push(...ids);
    frontier = ids;
  }
  return all;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const folderIds = await collectFolderIds(id);

  const { data: files } = await supabaseAdmin
    .from("project_files")
    .select("id, storage_path")
    .in("folder_id", folderIds);

  if (files && files.length > 0) {
    await supabaseAdmin.storage.from(FILES_BUCKET).remove(files.map((f) => f.storage_path));
    await supabaseAdmin.from("project_files").delete().in("id", files.map((f) => f.id));
  }

  // Deleting the root folder cascades to all descendant folder rows
  // automatically (parent_folder_id has ON DELETE CASCADE).
  await supabaseAdmin.from("project_folders").delete().eq("id", id);

  return NextResponse.json({ success: true });
}