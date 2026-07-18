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
  const base = process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${path}`;
};
