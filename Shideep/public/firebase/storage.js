// ==========================================================================
// Shideep — Storage Service
//
// ⚠️ CURRENTLY UNUSED. Firebase Storage requires the pay-as-you-go "Blaze"
// plan, which the project is intentionally avoiding for now. Gallery, Chat,
// and Memories all use pasted image URLs instead (see their page files).
//
// This file is kept as-is so re-enabling real uploads later is a matter of
// importing `compressImage`/`uploadFile` back into those pages — no rewrite
// needed. Nothing here runs unless something imports it.
// ==========================================================================

import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { storage } from "./config.js";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB ceiling (GAL/CHAT validation)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Compress an image client-side before upload (Performance Goals §12 / TAD §9).
 * Uses canvas resize; keeps aspect ratio; caps longest edge at maxDimension.
 */
export async function compressImage(file, maxDimension = 1600, quality = 0.82) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );
  return blob;
}

/**
 * Upload a file to a given storage path (e.g. `gallery/${uid}/${filename}`).
 * Validates size/type client-side; Storage Rules re-validate server-side.
 */
export async function uploadFile(path, file) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(fileRef);
}

export async function removeFile(path) {
  return deleteObject(ref(storage, path));
}
