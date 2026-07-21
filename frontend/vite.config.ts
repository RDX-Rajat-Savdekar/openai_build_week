import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function devBanner(): Plugin {
  return {
    name: "stitch-dev-banner",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        const port = typeof addr === "object" && addr ? addr.port : 5173;
        console.log("");
        console.log("[stitch-web] ── dev split ───────────────────────────────────");
        console.log(`[stitch-web] UI (open this)  →  http://localhost:${port}`);
        console.log("[stitch-web] API (proxied)     →  /api  →  http://localhost:3000/api");
        console.log("[stitch-web] ────────────────────────────────────────────────────");
        console.log("");
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devBanner()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/media": { target: "http://localhost:3000", changeOrigin: true },
      "/healthz": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
