import { defineConfig } from "vite";

// Frontend lives in src/; build output goes to dist/ for Firebase Hosting.
export default defineConfig({
  root: "src",
  publicDir: "../public",
  // .env lives at the repo root (one level up from the Vite root).
  envDir: "..",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 1234,
    open: true,
  },
});
