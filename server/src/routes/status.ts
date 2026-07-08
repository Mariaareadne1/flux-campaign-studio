import { Router } from "express";
import type { FluxStatus, StatusResponse } from "../../../shared/types";

/**
 * SSRF guard: we take a URL from the client and fetch it server-side, so we only
 * ever follow BFL-owned hosts (api.bfl.ai, api.eu.bfl.ai, delivery-*.bfl.ai, …).
 */
function isBflUrl(raw: string): boolean {
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
 * GET /api/status?pollingUrl=...
 * Thin proxy to a FLUX polling URL. Returns the normalized status and, when
 * Ready, the signed result URL (valid ~10 minutes — fetch it via /api/image).
 */
export const statusRouter = Router();

statusRouter.get("/", async (req, res) => {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Server is missing BFL_API_KEY. Add it to server .env." });
  }

  const pollingUrl = req.query.pollingUrl;
  if (typeof pollingUrl !== "string" || !pollingUrl) {
    return res.status(400).json({ error: "Missing 'pollingUrl' query param." });
  }
  if (!isBflUrl(pollingUrl)) {
    return res.status(400).json({ error: "'pollingUrl' must be a bfl.ai URL." });
  }

  try {
    const resp = await fetch(pollingUrl, {
      headers: { "x-key": apiKey, accept: "application/json" },
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return res
        .status(resp.status)
        .json({ error: `FLUX poll failed (${resp.status}).`, detail });
    }

    const data = (await resp.json()) as {
      status: FluxStatus;
      result?: { sample?: string } | null;
      error?: string;
    };

    const out: StatusResponse = {
      status: data.status,
      resultUrl: data.result?.sample,
      error: data.error ?? undefined,
    };
    return res.json(out);
  } catch (err) {
    return res
      .status(502)
      .json({ error: "Failed to reach FLUX.", detail: String(err) });
  }
});
