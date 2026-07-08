import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client talks ONLY to our own backend. In dev we proxy /api to the Express
// server so the browser never touches the FLUX API (which has no CORS) directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
    // Allow importing the shared/ types folder, which lives outside client root.
    fs: {
      allow: [".."],
    },
  },
});
