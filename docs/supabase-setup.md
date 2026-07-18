# Supabase production setup

1. Create a Supabase project and copy its Project URL and publishable key.
2. Copy `.env.example` to `.env.local`, then set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL`.
3. Apply `supabase/migrations/202607180001_accounts_and_visits.sql` using the Supabase CLI (`supabase db push`) or the dashboard SQL editor.
4. Verify that `profiles`, `visits`, and `visit_photographs` have Row Level Security enabled and that the `visit-photos` bucket is private.
5. In Authentication → URL Configuration, set the Site URL and allow both the local URL and production/native recovery URLs.
6. Keep email confirmation enabled. Configure a production SMTP sender before public release.
7. Deploy both deletion functions:
   - `supabase functions deploy delete-visit`
   - `supabase functions deploy delete-account`
   Supabase supplies its project URL and keys to deployed functions; never add the service-role key to client environment variables.
8. Run the cross-user RLS checks in `supabase/tests/rls-verification.sql` with two real test accounts before release.
