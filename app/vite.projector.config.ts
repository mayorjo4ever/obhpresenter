import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This renderer has its own HTML entry (projector.html) instead of the
// default index.html the main control window uses — they're two separate
// windows, not routes within one page.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, "projector.html"),
    },
  },
});
