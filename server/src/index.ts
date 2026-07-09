import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import express from "express";

// The .env lives at the repo root, but npm runs this workspace with cwd=server/,
// so resolve the path from this file (server/src/index.ts -> ../../.env) instead
// of relying on cwd. This is why a key pasted into the root .env is actually read.
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: resolve(rootDir, ".env") });

import cors from "cors";
import { generateRouter } from "./routes/generate";
import { statusRouter } from "./routes/status";
import { imageRouter } from "./routes/image";
import { uploadRouter } from "./routes/upload";
import { runRouter } from "./routes/run";
import { ensureUploadsDir, UPLOADS_DIR } from "./storage";

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// The frontend talks ONLY to these routes; the backend holds the key and is the
// only thing that talks to FLUX.
app.use("/api/generate", generateRouter); // POST -> FLUX submit
app.use("/api/status", statusRouter); // GET  -> FLUX polling
app.use("/api/image", imageRouter); // GET  -> proxy-download a result URL
app.use("/api/upload", uploadRouter); // POST -> store a product image
app.use("/api/run", runRouter); // POST -> start a campaign; GET /:id -> progress

// Serve stored images (uploads + persisted results). express.static guards
// against path traversal.
ensureUploadsDir();
app.use("/api/uploads", express.static(UPLOADS_DIR));

// Unknown /api routes get JSON, not an HTML page.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Catch-all so a thrown handler returns JSON instead of crashing the request.
const errorHandler: express.ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  // Client errors (e.g. body-parser's malformed-JSON SyntaxError) carry a 4xx
  // status — relay that; everything else is a real server fault.
  const status =
    typeof (err as { status?: number }).status === "number" &&
    (err as { status: number }).status >= 400 &&
    (err as { status: number }).status < 500
      ? (err as { status: number }).status
      : 500;
  if (status >= 500) console.error("[server] unhandled route error:", err);
  res.status(status).json({
    error: status < 500 ? "Bad request." : "Internal server error.",
  });
};
app.use(errorHandler);

// A bug in a background run (fire-and-forget executor) must never take the
// process down — log and keep serving.
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
});

if (!process.env.BFL_API_KEY) {
  console.warn(
    "[server] WARNING: BFL_API_KEY is not set. Add it to the root .env before running a campaign.",
  );
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
