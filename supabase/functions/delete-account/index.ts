import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { cleanupPhotos } from "../_shared/photo-cleanup.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Function configuration is incomplete" }, 500);
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  try {
    await cleanupPhotos(
      (from, to) => admin.from("visit_photographs").select("storage_path").eq("user_id", user.id).order("id").range(from, to),
      paths => admin.storage.from("visit-photos").remove(paths),
      user.id
    );
  } catch {
    return json({ error: "Could not safely delete photographs; please retry or contact support" }, 503);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: "Could not delete account" }, 500);
  return json({ deleted: true });
});
