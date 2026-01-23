import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";
import zipPack from "vite-plugin-zip-pack";
import { resolve } from "path";

const isWatch = process.argv.includes("--watch");
const mode = process.env.NODE_ENV || "production";
const isTest = !!process.env.VITEST;

export default defineConfig({
  plugins: [
    svelte(),
    viteStaticCopy({
      targets: [
        { src: "plugin.json", dest: "./" },
        { src: "README.md", dest: "./" },
        { src: "icon.png", dest: "./" },
        { src: "preview.png", dest: "./" },
        { src: "assets", dest: "./" },
      ],
    }),
    ...(!isWatch
      ? [
          zipPack({
            inDir: "./dist",
            outDir: "./",
            outFileName: "package.zip",
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      ...(isTest
        ? {
            siyuan: resolve(__dirname, "src/__tests__/siyuan-stub.ts"),
            // Use real rrule library in tests
          }
        : {}),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: mode === "production",
    sourcemap: mode === "development" ? "inline" : false,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: "index",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["siyuan"],
      output: {
        entryFileNames: "index.js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") {
            return "index.css";
          }
          return assetInfo.name;
        },
      },
    },
  },
});
