import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";
import { publicEnvironment } from "./build/public-env";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");

  return {
    root: resolve(__dirname, "mobile"),
    publicDir: resolve(__dirname, "public"),
    base: "./",
    plugins: [react()],
    define: publicEnvironment(env),
    build: {
      outDir: resolve(__dirname, "dist-mobile"),
      emptyOutDir: true
    }
  };
});
