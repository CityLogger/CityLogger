/** Explicit browser-safe allowlist, shared by web and Capacitor builds. */
export function publicEnvironment(env: Record<string, string>) {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_CARTO_BASEMAP_API_KEY"];
  return Object.fromEntries(keys.map(key => [`process.env.${key}`, JSON.stringify(env[key] || "")]));
}
