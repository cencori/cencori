import { createAdminClient } from "@/lib/supabaseAdmin";

export const BUCKET_NAME =
  process.env.SUPABASE_STORAGE_BUCKET ?? "scan-exports";

// ── Upload ───────────────────────────────────────────────────────
// Uploads a file buffer to Supabase Storage and returns the file path in the bucket
export async function uploadExportFile(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const admin = createAdminClient();
  // Use a timestamp prefix so file names are always unique
  const filePath = `exports/${Date.now()}-${fileName}`;

  const { error } = await admin.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false, // never overwrite — each export is a new file
    });

  if (error) {
    throw new Error(`[storage] Upload failed: ${error.message}`);
  }

  return filePath;
}

// ── Signed URL ───────────────────────────────────────────────────
// Generates a temporary signed URL that expires after 1 hour
// Signed URLs allow access to private bucket files without making them public
export async function getSignedDownloadUrl(filePath: string): Promise<string> {
  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600); // 3600 seconds = 1 hour

  if (error || !data?.signedUrl) {
    throw new Error(
      `[storage] Signed URL generation failed: ${error?.message}`,
    );
  }

  return data.signedUrl;
}

// ── Delete a single file ─────────────────────────────────────────
// Used by the cleanup cron to delete individual expired files
export async function deleteExportFile(filePath: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.storage.from(BUCKET_NAME).remove([filePath]);

  if (error) {
    // Log but don't throw — deletion failure shouldn't crash the cron
    console.warn(`[storage] Failed to delete ${filePath}: ${error.message}`);
  }
}

// ── List old files ───────────────────────────────────────────────
// Returns the paths of all files in the bucket older than olderThanMs milliseconds
// Used by the cleanup cron to find files to delete
export async function listOldExportFiles(
  olderThanMs: number,
): Promise<string[]> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - olderThanMs);

  const { data, error } = await admin.storage
    .from(BUCKET_NAME)
    .list("exports", {
      limit: 1000,
      sortBy: { column: "created_at", order: "asc" },
    });

  if (error || !data) {
    console.error("[storage] Failed to list files:", error?.message);
    return [];
  }

  // Filter to files older than the cutoff
  return data
    .filter((file) => file.created_at && new Date(file.created_at) < cutoff)
    .map((file) => `exports/${file.name}`);
}
