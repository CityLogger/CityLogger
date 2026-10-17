# Optional visit details

The visit editor now allows arrival/departure dates to be omitted independently.
Dates start empty, and Clear dates removes both. Undated visits show "Dates not
added" rather than pretending the logging date is the visit date. Their creation
time determines journal ordering; they do not count toward a dated yearly goal.

Personal experience only hides all other categories and saves them as null. The
overall score is then the personal-experience score. Add category ratings restores
the detailed editor. Toggling without saving preserves the draft category values;
editing a saved personal-only visit and enabling categories starts new core scores
at 4. No existing stored visits are changed by the database migration.

## Database deployment

Applied to the production Supabase project on 16 October 2026 through the SQL
Editor. A follow-up `information_schema.columns` query confirmed that all five
columns are nullable. The SQL remains in
`supabase/migrations/202610160001_optional_visit_details.sql` for source control.
The change preserves existing validation, ownership policies and data, and
previous client builds remain compatible. Because the CLI was not authenticated,
this manual SQL execution may not appear in CLI migration history; the migration
is safe to rerun when the CLI history is reconciled.

Cloud create/edit with omitted dates or category ratings should now pass the
database constraints. A signed-in end-to-end save test is still needed before
calling the feature release-verified.
