/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { layoutWriterPlugin } from "./vite-plugins/layoutWriter.ts";
import { patternUsagesPlugin } from "./vite-plugins/patternUsages.ts";
import { themeBootstrapPlugin } from "./vite-plugins/themeBootstrap.ts";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    patternUsagesPlugin(),
    themeBootstrapPlugin(),
    layoutWriterPlugin(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
  },
});
