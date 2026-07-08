import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// API routes are mounted here as the phases progress:
//   POST /api/generate   -> proxy FLUX submit
//   GET  /api/status     -> proxy FLUX polling
//   GET  /api/image      -> proxy-download a FLUX result URL (defeats CORS + expiry)

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
