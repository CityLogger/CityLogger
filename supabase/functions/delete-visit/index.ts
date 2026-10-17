import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { cleanupPhotos, validVisitId } from "../_shared/photo-cleanup.ts";

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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const visitId = validVisitId(payload);
  if (!visitId) return json({ error: "A valid visit_id is required" }, 400);

  const { data: visit, error: visitReadError } = await admin.from("visits").select("id").eq("id", visitId).eq("user_id", user.id).maybeSingle();
  if (visitReadError) return json({ error: "Could not inspect visit" }, 500);
  if (!visit) return json({ error: "Visit not found" }, 404);

  try {
    await cleanupPhotos(
      (from, to) => admin.from("visit_photographs").select("storage_path").eq("visit_id", visit.id).eq("user_id", user.id).order("id").range(from, to),
      paths => admin.storage.from("visit-photos").remove(paths),
      user.id,
      visit.id
    );
  } catch {
    return json({ error: "Could not safely remove photographs; visit was not deleted. Please retry or contact support" }, 503);
  }

  const { error: deleteError } = await admin.from("visits").delete().eq("id", visit.id).eq("user_id", user.id);
  if (deleteError) return json({ error: "Could not delete visit; please retry" }, 500);
  return json({ deleted: true, storage_cleanup_pending: false });
});
