import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.CITYLOGGER_REVIEW_EMAIL || "appreview@citylogger.test";
const password = process.env.CITYLOGGER_REVIEW_PASSWORD;
if (!url || !publishableKey || !password) throw new Error("Missing review verification environment variables.");

const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError || !signIn.user) throw signInError || new Error("Review sign-in returned no user.");

const [profile, visits, wishlist, lists, listCities] = await Promise.all([
  client.from("profiles").select("display_name, yearly_goal, ranking_order").single(),
  client.from("visits").select("id, city_name, date_from").order("date_from", { ascending: false }),
  client.from("wishlist_cities").select("id"),
  client.from("personal_lists").select("id"),
  client.from("personal_list_cities").select("id")
]);
const error = profile.error || visits.error || wishlist.error || lists.error || listCities.error;
if (error) throw error;

const result = {
  sign_in: "passed",
  email_verified: Boolean(signIn.user.email_confirmed_at),
  display_name: profile.data.display_name,
  yearly_goal: profile.data.yearly_goal,
  ranking_entries: profile.data.ranking_order?.length || 0,
  visits: visits.data?.length || 0,
  current_year_visits: visits.data?.filter(visit => visit.date_from.startsWith(`${new Date().getFullYear()}-`)).length || 0,
  want_to_visit: wishlist.data?.length || 0,
  personal_lists: lists.data?.length || 0,
  personal_list_entries: listCities.data?.length || 0
};

const expected = { visits: 10, want_to_visit: 5, personal_lists: 2, ranking_entries: 10 };
for (const [key, value] of Object.entries(expected)) if (result[key] !== value) throw new Error(`Expected ${key}=${value}, received ${result[key]}.`);
console.log(JSON.stringify(result, null, 2));
await client.auth.signOut();
