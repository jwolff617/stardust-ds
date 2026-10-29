"use client";

import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/posts";

// Shrinks a photo on the phone before it uploads: longest side 1280px,
// JPEG at 0.72, usually 100 to 250 KB. Then uploads it to your own folder
// in the post-photos bucket. Returns the storage path.
export async function uploadPhoto(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't a photo.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Couldn't read that photo. Try a JPEG or PNG.");
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
  if (!blob) throw new Error("Couldn't shrink that photo.");

  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await createClient().storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(`Photo didn't upload: ${error.message}`);
  return path;
}

export async function removeUploaded(paths: string[]) {
  if (paths.length > 0) await createClient().storage.from(PHOTO_BUCKET).remove(paths);
}
