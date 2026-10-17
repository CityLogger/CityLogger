import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { BackendError } from "./errors";

export function getBackendClient(): SupabaseClient {
  if (!supabase) throw new BackendError("NOT_CONFIGURED", "CityLog cloud storage is not configured.");
  return supabase;
}

export async function requireCurrentUser(expectedUserId?: string): Promise<User> {
  const client = getBackendClient();
  const { data: before } = await client.auth.getSession();
  const { data, error } = await client.auth.getUser();
  const { data: after } = await client.auth.getSession();
  if (error || !data.user || (expectedUserId && data.user.id !== expectedUserId) || before.session?.user.id !== data.user.id || after.session?.user.id !== data.user.id) {
    throw new BackendError("NOT_AUTHENTICATED", "Sign in to access your private travel data.", error);
  }
  return data.user;
}
