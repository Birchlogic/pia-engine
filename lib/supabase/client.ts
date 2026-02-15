import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(
        "Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    );
}

export const supabase = createClient(
    supabaseUrl || "",
    supabaseServiceKey || ""
);

export const BUCKET_NAME = "session-files";

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the storage path on success.
 */
export async function uploadToSupabase(
    buffer: Buffer,
    fileName: string,
    mimeType: string
): Promise<string> {
    const storagePath = `uploads/${Date.now()}-${fileName}`;

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return storagePath;
}

/**
 * Get a signed download URL for a file (valid for 1 hour).
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
        throw new Error(`Failed to get signed URL: ${error?.message}`);
    }

    return data.signedUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFromSupabase(storagePath: string): Promise<void> {
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

    if (error) {
        console.warn(`Failed to delete file from Supabase: ${error.message}`);
    }
}
