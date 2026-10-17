import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const authRedirectUrl = (path = "") => {
  if (Capacitor.isNativePlatform()) {
    return `citylogger://auth${path}`;
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  try {
    if (configured) {
      const url = new URL(configured);
      if (url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        return `${url.origin}${path}`;
      }
    }
  } catch { /* An invalid or local development URL must never reach a real email. */ }
  return `https://citylogger.app${path}`;
};
