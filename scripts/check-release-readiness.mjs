import { readFile } from "node:fs/promises";

const requiredFiles = [
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/support/page.tsx",
  "src/frontend/CityLogger.tsx",
  "ios/App/App/Info.plist",
  "ios/App/App/AppDelegate.swift",
  "ios/App/App/SceneDelegate.swift",
  "docs/app-store-checklist.md"
];

const contents = Object.fromEntries(await Promise.all(requiredFiles.map(async path => [path, await readFile(path, "utf8")])));
const releaseSurface = [
  contents["app/privacy/page.tsx"],
  contents["app/terms/page.tsx"],
  contents["app/support/page.tsx"],
  contents["src/frontend/CityLogger.tsx"],
  contents["ios/App/App/Info.plist"]
].join("\n");
const failures = [];

for (const forbidden of [
  "jpaiplatform.com",
  "PRIVACY CONTACT EMAIL TO BE COMPLETED",
  "LEGAL CONTACT DETAILS TO BE COMPLETED",
  "Developer action required before release"
]) {
  if (releaseSurface.includes(forbidden)) failures.push(`Release placeholder or obsolete value remains: ${forbidden}`);
}

const requiredSnippets = [
  ["app/support/page.tsx", "support@citylogger.app"],
  ["src/frontend/CityLogger.tsx", "https://citylogger.app"],
  ["ios/App/App/Info.plist", "ITSAppUsesNonExemptEncryption"],
  ["ios/App/App/Info.plist", "UIApplicationSceneManifest"],
  ["ios/App/App/AppDelegate.swift", "configurationForConnecting"],
  ["ios/App/App/SceneDelegate.swift", "openURLContexts"],
  ["docs/app-store-checklist.md", "Age Assurance"],
  ["docs/app-store-checklist.md", "https://citylogger.app/support"]
];

for (const [path, snippet] of requiredSnippets) {
  if (!contents[path].includes(snippet)) failures.push(`${path} is missing required release content: ${snippet}`);
}

if (failures.length) {
  console.error(failures.map(failure => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Release content check passed. App Store Connect actions and physical-device testing remain manual release gates.");
