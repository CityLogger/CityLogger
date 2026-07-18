import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");

  return {
    root: resolve(__dirname, "mobile"),
    publicDir: resolve(__dirname, "public"),
    base: "./",
    plugins: [react()],
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL),
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      "process.env.NEXT_PUBLIC_APP_URL": JSON.stringify(env.NEXT_PUBLIC_APP_URL)
    },
    build: {
      outDir: resolve(__dirname, "dist-mobile"),
      emptyOutDir: true
    }
  };
});
