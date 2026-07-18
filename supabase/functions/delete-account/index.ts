import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ error: "Authentication required" }, { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return Response.json({ error: "Invalid session" }, { status: 401 });

  const { data: photographRows, error: photographError } = await admin
    .from("visit_photographs")
    .select("storage_path")
    .eq("user_id", user.id);
  if (photographError) return Response.json({ error: "Could not list photographs" }, { status: 500 });
  if (photographRows?.length) {
    const paths = photographRows.map(row => row.storage_path);
    const { error } = await admin.storage.from("visit-photos").remove(paths);
    if (error) return Response.json({ error: "Could not delete photographs" }, { status: 500 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });
  return Response.json({ deleted: true });
});
