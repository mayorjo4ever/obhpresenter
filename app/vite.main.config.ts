import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // ws tries to conditionally require() two OPTIONAL native
      // performance add-ons (bufferutil, utf-8-validate). Node handles
      // a missing one gracefully at runtime via ws's own try/catch, but
      // Rollup statically resolves every require() at build time and
      // crashes when those optional packages aren't installed.
      //
      // IMPORTANT: only these two are externalized — ws and qrcode
      // themselves must stay bundled (not external), because this
      // project's packaged build does NOT ship a node_modules folder
      // (the Vite plugin's packaging strategy fully bundles instead of
      // copying node_modules). Externalizing ws/qrcode would build fine
      // in dev but crash the packaged app with "Cannot find module ws".
      external: ["bufferutil", "utf-8-validate"],
    },
  },
});
