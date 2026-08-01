import { access, copyFile, mkdir } from "node:fs/promises";

async function copyModuleEntryIfNeeded(source, destination) {
  try {
    await access(source);
    await copyFile(source, destination);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await copyModuleEntryIfNeeded("dist/server/index.mjs", "dist/server/index.js");
await copyModuleEntryIfNeeded("dist/server/ssr/index.mjs", "dist/server/ssr/index.js");
await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
