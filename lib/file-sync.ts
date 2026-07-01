import { supabaseAdmin, FILES_BUCKET, getFileType } from "@/lib/supabase-admin";
import { parseCodeFilesFromConversation } from "@/lib/code-parser";

async function getOrCreateFolderChain(
  projectId: string,
  segments: string[]
): Promise<string | null> {
  let parentId: string | null = null;
  for (const segment of segments) {
    let query = supabaseAdmin
      .from("project_folders")
      .select("id")
      .eq("project_id", projectId)
      .eq("name", segment);
    query = parentId ? query.eq("parent_folder_id", parentId) : query.is("parent_folder_id", null);
    const { data: existing } = await query.maybeSingle();

    if (existing) {
      parentId = existing.id;
      continue;
    }

    const { data: created, error } = await supabaseAdmin
      .from("project_folders")
      .insert({ project_id: projectId, name: segment, parent_folder_id: parentId })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message || "Failed to create folder");
    parentId = created.id;
  }
  return parentId;
}

export async function syncCodeFilesFromMemory(
  projectId: string,
  memoryId: string,
  rawConversation: string,
  userId: string
): Promise<{ synced: number }> {
  const extracted = parseCodeFilesFromConversation(rawConversation);
  if (extracted.length === 0) return { synced: 0 };

  let synced = 0;

  for (const { path, content } of extracted) {
    try {
      const segments = path.split("/").filter(Boolean);
      const filename = segments.pop();
      if (!filename) continue;

      const folderId = segments.length > 0 ? await getOrCreateFolderChain(projectId, segments) : null;

      let query = supabaseAdmin
        .from("project_files")
        .select("id, storage_path")
        .eq("project_id", projectId)
        .eq("name", filename);
      query = folderId ? query.eq("folder_id", folderId) : query.is("folder_id", null);
      const { data: existingFile } = await query.maybeSingle();

      const fileType = getFileType(filename);
      const blob = new Blob([content], { type: "text/plain" });

      if (existingFile) {
        await supabaseAdmin.storage
          .from(FILES_BUCKET)
          .upload(existingFile.storage_path, blob, { contentType: "text/plain", upsert: true });
        await supabaseAdmin
          .from("project_files")
          .update({
            size_bytes: blob.size,
            updated_at: new Date().toISOString(),
            synced_from_memory_id: memoryId,
          })
          .eq("id", existingFile.id);
      } else {
        const fileId = crypto.randomUUID();
        const storagePath = `${userId}/${projectId}/${fileId}-${filename}`;
        await supabaseAdmin.storage
          .from(FILES_BUCKET)
          .upload(storagePath, blob, { contentType: "text/plain", upsert: false });
        await supabaseAdmin.from("project_files").insert({
          id: fileId,
          project_id: projectId,
          user_id: userId,
          name: filename,
          storage_path: storagePath,
          file_type: fileType,
          mime_type: "text/plain",
          size_bytes: blob.size,
          folder_id: folderId,
          synced_from_memory_id: memoryId,
        });
      }
      synced += 1;
    } catch (err) {
      console.error(`file-sync: failed to sync "${path}"`, err);
    }
  }

  return { synced };
}