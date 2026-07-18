import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { BackendError } from "./errors";

export function getBackendClient(): SupabaseClient {
  if (!supabase) throw new BackendError("NOT_CONFIGURED", "CityLogger cloud storage is not configured.");
  return supabase;
}

export async function requireCurrentUser(): Promise<User> {
  const client = getBackendClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new BackendError("NOT_AUTHENTICATED", "Sign in to access your private travel data.", error);
  }
  return data.user;
}
