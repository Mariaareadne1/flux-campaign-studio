import { Router } from "express";

/**
 * FLUX result URLs live on BFL delivery hosts and expire in ~10 minutes, and
 * they do NOT send CORS headers. This route downloads them server-side and
 * streams the bytes back, solving CORS + expiry in one place.
 *
 * SSRF guard: only follow BFL-owned https hosts. A forker delivering results
 * from elsewhere can extend the allowlist here.
 */
function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      (u.hostname === "bfl.ai" || u.hostname.endsWith(".bfl.ai"))
    );
  } catch {
    return false;
  }
}

/**
 * GET /api/image?url=...
 * Proxy-download a FLUX result image and stream it back to the browser.
 */
export const imageRouter = Router();

imageRouter.get("/", async (req, res) => {
  const url = req.query.url;
  if (typeof url !== "string" || !url) {
    return res.status(400).json({ error: "Missing 'url' query param." });
  }
  if (!isAllowedImageUrl(url)) {
    return res.status(400).json({ error: "'url' host is not allowed." });
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return res
        .status(resp.status)
        .json({ error: `Image download failed (${resp.status}).` });
    }

    const contentType =
      resp.headers.get("content-type") ?? "application/octet-stream";
    res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "public, max-age=3600");

    const bytes = Buffer.from(await resp.arrayBuffer());
    return res.send(bytes);
  } catch (err) {
    return res
      .status(502)
      .json({ error: "Failed to download image.", detail: String(err) });
  }
});
