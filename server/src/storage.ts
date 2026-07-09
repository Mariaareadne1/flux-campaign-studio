import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Local file storage for images: the uploaded product photo and every
 * persisted FLUX result. Living on disk under server/uploads/ (git-ignored)
 * means result images survive the ~10-minute FLUX URL expiry and can be
 * re-served and re-fed to FLUX as input_image.
 */
const thisDir = dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = resolve(thisDir, "../uploads");

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function ensureUploadsDir(): void {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
}

/** Save raw image bytes and return its id (filename) + served URL. */
export function saveImageBytes(
  bytes: Buffer,
  contentType: string,
): { id: string; url: string } {
  ensureUploadsDir();
  const ext = MIME_TO_EXT[contentType.toLowerCase()] ?? "png";
  const id = `${randomUUID()}.${ext}`;
  writeFileSync(resolve(UPLOADS_DIR, id), bytes);
  return { id, url: `/api/uploads/${id}` };
}

/** Save a "data:image/...;base64,..." URL (used by the upload route). */
export function saveDataUrl(dataUrl: string): { id: string; url: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 image data URL.");
  const [, contentType, base64] = match;
  return saveImageBytes(Buffer.from(base64, "base64"), contentType);
}

/**
 * Read a stored image back as a base64 data URL. FLUX can't reach our
 * localhost URLs, so we pass images to it inline as base64 input_image.
 */
export function readAsDataUrl(id: string): string {
  const safeId = sanitizeId(id);
  const bytes = readFileSync(resolve(UPLOADS_DIR, safeId));
  const ext = extname(safeId).slice(1).toLowerCase();
  const mime = EXT_TO_MIME[ext] ?? "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/** Only allow a bare filename — never a path — to prevent directory traversal. */
function sanitizeId(id: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    throw new Error(`Invalid image id '${id}'.`);
  }
  return id;
}
