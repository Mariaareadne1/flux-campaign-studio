import { Router } from "express";
import type { UploadResponse } from "../../../shared/types";
import { saveDataUrl } from "../storage";

/**
 * POST /api/upload
 * Accepts a base64 image data URL, stores it under server/uploads/, and returns
 * its id + served URL. The stored file is later fed to FLUX as input_image and
 * displayed in the UI.
 */
export const uploadRouter = Router();

uploadRouter.post("/", (req, res) => {
  const dataUrl = (req.body ?? {}).dataUrl;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return res
      .status(400)
      .json({ error: "Expected body { dataUrl: 'data:image/...;base64,...' }." });
  }

  try {
    const saved = saveDataUrl(dataUrl);
    const out: UploadResponse = saved;
    return res.json(out);
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Failed to store image.", detail: String(err) });
  }
});
