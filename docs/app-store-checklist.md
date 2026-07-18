# CityLogger App Store checklist

This checklist supports preparation but does not guarantee App Store approval.

## Required before submission

- [ ] Publish the completed Privacy Policy and enter its public URL in App Store Connect.
- [ ] Publish a working support page with current contact details and enter its URL.
- [ ] Replace every bracketed legal and business placeholder in the Privacy Policy and Terms.
- [ ] Create an App Review test account containing representative visits.
- [ ] Confirm account deletion is available at Profile → Account & Privacy → Delete Account.
- [ ] Confirm data export is available at Profile → Account & Privacy → Download My Data.
- [ ] Connect and verify the production Supabase project.
- [ ] Apply all database migrations and verify Row Level Security policies.
- [ ] Confirm the `visit-photos` Storage bucket is private.
- [ ] Deploy the authenticated `delete-account` Edge Function.
- [ ] Configure Supabase email verification templates and sender details.
- [ ] Add production and native-app authentication redirect URLs.
- [ ] Test forgotten-password and password-recovery redirects on a physical iPhone.
- [ ] Complete App Store privacy disclosures for email, user content, photos, identifiers and product interaction as actually collected.
- [ ] Record accessibility support accurately in App Store Connect.
- [ ] Add permission usage descriptions only for capabilities the final native app requests.
- [ ] Test account creation, sign-in, restoration, export and deletion on the submitted build.

## Review notes

- Explain that an account is optional for browsing but required to save and sync a private travel history.
- State that CityLogger contains no public profiles or public user-generated content in this release.
- Give App Review the test account credentials and any email-verification instructions.
