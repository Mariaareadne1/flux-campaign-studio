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

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
