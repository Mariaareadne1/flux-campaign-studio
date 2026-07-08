import { Router } from "express";
import { downloadImage } from "../flux/client";
import { normalizeError } from "../flux/errors";

/**
 * GET /api/image?url=...
 * Proxy-download a FLUX result image and stream the bytes back to the browser.
 *
 * FLUX result URLs live on BFL delivery hosts, expire in ~10 minutes, and send
 * no CORS headers — this route solves CORS + expiry in one place. The URL is
 * validated against the BFL host allowlist inside downloadImage (SSRF guard).
 */
export const imageRouter = Router();

imageRouter.get("/", async (req, res) => {
  const url = req.query.url;
  if (typeof url !== "string" || !url) {
    return res.status(400).json({ error: "Missing 'url' query param." });
  }

  try {
    const { contentType, bytes } = await downloadImage(url);
    res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "public, max-age=3600");
    return res.send(bytes);
  } catch (err) {
    const e = normalizeError(err);
    return res.status(e.status).json(e.toApiError());
  }
});
