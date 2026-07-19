import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @tauri-apps/cli sets TAURI_DEV_HOST for mobile/remote dev; harmless on desktop.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port and clean console output.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Don't reload the Vite dev server when Rust source changes.
      ignored: ["**/src-tauri/**"],
    },
  },
  // Expose TAURI_* env vars to the client without leaking everything.
  envPrefix: ["VITE_", "TAURI_"],
});
