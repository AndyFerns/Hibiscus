import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import MonacoEditorPlugin from "vite-plugin-monaco-editor"
import svgr from "vite-plugin-svgr";
import type { Plugin } from "vite";
// @ts-expect-error node built-ins are available when Vite loads this config
import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
// @ts-expect-error node built-ins are available when Vite loads this config
import { resolve, sep } from "node:path";
// @ts-expect-error node built-ins are available when Vite loads this config
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

/**
 * Serve and ship pdf.js character maps and standard fonts at ./pdfjs/.
 * Without them, PDFs using CJK text or the 14 standard fonts (and no embedded
 * copies) render with missing or substituted glyphs.
 */
function pdfjsAssets(): Plugin {
  const pdfjsRoot = resolve(projectRoot, "node_modules", "pdfjs-dist");
  const dirs = ["cmaps", "standard_fonts"];
  return {
    name: "hibiscus-pdfjs-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url && /^\/pdfjs\/(cmaps|standard_fonts)\/([^?#]+)/.exec(req.url);
        if (!match) return next();
        const base = resolve(pdfjsRoot, match[1]);
        const file = resolve(base, decodeURIComponent(match[2]));
        if (!file.startsWith(base + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      const out = options.dir ?? resolve(projectRoot, "dist");
      for (const dir of dirs) {
        cpSync(resolve(pdfjsRoot, dir), resolve(out, "pdfjs", dir), { recursive: true });
      }
    },
  };
}

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),

    // for icon rendering
    svgr(),

    // pdf.js cMaps + standard fonts for the PDF viewer
    pdfjsAssets(),

    // monaco editor plugin referencing
    (MonacoEditorPlugin as any).default({
      // keep this minimal
      languageWorkers: [
        "editorWorkerService",
        "json",
        "css",
        "html",
        "typescript"
      ]
    })
  ],

  // important for tauri-based builds for path resolution
  base: "./",

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    target: "esnext",
  },
}));
