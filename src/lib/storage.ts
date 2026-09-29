import { supabase } from "@/integrations/supabase/client";

export type MediaBucket = "team-logos" | "team-photos" | "team-videos";

const TEN_YEARS = 60 * 60 * 24 * 3650;

/**
 * Upload a file and return a long-lived readable URL for it.
 * Buckets are private, so we hand back a signed URL rather than a raw path.
 */
export async function uploadMedia(bucket: MediaBucket, file: File, prefix = "misc") {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, TEN_YEARS);
  if (signError || !data?.signedUrl) throw signError ?? new Error("Could not link that file.");

  return data.signedUrl;
}
