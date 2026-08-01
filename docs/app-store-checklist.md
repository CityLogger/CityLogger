# CityLogger App Store checklist

This checklist supports preparation but does not guarantee App Store approval.

## Required before submission

- [ ] Publish the completed Privacy Policy and enter its public URL in App Store Connect.
- [ ] Publish a working support page with current contact details and enter its URL.
- [ ] Replace every bracketed legal and business placeholder in the Privacy Policy and Terms.
- [x] Create and email-confirm a dedicated App Review account with no MFA or inbox dependency.
- [x] Seed the review account with 10 visits, varied ratings, optional ratings, visit types, dates and notes.
- [x] Seed five Want to Visit cities, two personalised lists, a custom ranking and a 12-city yearly goal.
- [x] Persist goals, rankings, Want to Visit and personalised lists in Supabase so clean devices receive them.
- [ ] Confirm account deletion is available at Profile → Account & Privacy → Delete Account.
- [ ] Confirm data export is available at Profile → Account & Privacy → Download My Data.
- [x] Connect and verify the production Supabase project.
- [x] Apply all database migrations and verify account access through Row Level Security.
- [ ] Deploy the authenticated `delete-account` Edge Function.
- [ ] Configure Supabase email verification templates and sender details.
- [ ] Add production and native-app authentication redirect URLs.
- [ ] Test forgotten-password and password-recovery redirects on a physical iPhone.
- [ ] Complete App Store privacy disclosures for email, user content, identifiers and product interaction as actually collected.
- [ ] Record accessibility support accurately in App Store Connect.
- [ ] Add permission usage descriptions only for capabilities the final native app requests.
- [x] Test review-account sign-in and pre-populated data in a clean browser session at iPhone 17 Pro Max dimensions.
- [x] Test responsive layout, navigation and cloud data at iPad Air 11-inch dimensions.
- [ ] Build/archive version 1.0 (5) in Xcode and test it on a physical iPhone and iPad simulator.
- [ ] Test password recovery, export and deletion on a separate non-review test account. Do not delete the only review account.

## App Store Connect changes — complete manually

For CityLog 1.0, open **App Review Information** and:

- Enable the option indicating that sign-in is required.
- Enter the review email shown in the private release handoff.
- Enter the review password shown in the private release handoff. Do not commit it to GitHub.
- Paste the review notes below.
- Save the version metadata. Keep the credentials unchanged until review is complete.

No Apple account changes were made by Codex.

## Paste-ready review notes

CityLog uses an optional private account for saving and syncing travel data. A dedicated, email-confirmed review account is provided in App Review Information. It does not use MFA, one-time codes, or require access to an email inbox.

To review the pre-populated content: launch the app, tap **Profile** in the bottom bar, tap **Create account or sign in**, then **I already have an account**, and enter the supplied credentials. After sign-in:

- **Map** shows 10 rated visited-city markers and 5 smaller purple Want to Visit markers.
- **Rankings** contains a manually ordered 10-city ranking; use the up/down controls to change the order on iPhone or iPad.
- **Log** contains visits from 2021–2026. Tap Lisbon or Kyoto to view full category ratings, dates, visit type and note.
- **Lists** contains Want to Visit, Best food cities and Most underrated. Compare Cities is at the bottom of this section.
- **Profile** shows 3 of 12 cities completed for the 2026 goal, plus data export and account deletion.

All saved content is private to this account. Please do not test account deletion using this sole review account; the deletion control is visible in Profile under Account & Privacy.

## General review notes

- Explain that an account is optional for browsing but required to save and sync a private travel history.
- State that CityLogger contains no public profiles or public user-generated content in this release.
- Give App Review the test account credentials. No email verification step is required for this pre-confirmed account.
