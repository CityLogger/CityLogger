# CityLogger App Store resubmission checklist

Last code review: 4 October 2026. This checklist supports preparation but does not guarantee approval.

## Implemented in the product

- [x] Email/password accounts use the production Supabase project.
- [x] Visits, ratings, notes, Want to Visit, personal lists, ranking order, profile details and yearly goals persist per account.
- [x] A dedicated, email-confirmed App Review account can be seeded without MFA or inbox access.
- [x] The review seed contains 10 visits across six continents, varied ratings and dates, optional ratings, visit types and notes.
- [x] The review seed contains five Want to Visit cities, two personal lists, a custom 10-city ranking and a 12-city yearly goal.
- [x] Account data export is available at **Profile → Account & Privacy → Download My Data**.
- [x] Account deletion is available at **Profile → Account & Privacy → Delete Account**.
- [x] Authenticated account- and visit-deletion Edge Functions are deployed.
- [x] Production email verification and password recovery use the verified CityLogger SMTP sender.
- [x] Production web and `citylogger://auth` native redirect URLs are configured.
- [x] A public support page is implemented at `https://citylogger.app/support`.
- [x] Privacy Policy and Terms are linked inside the app and contain no release placeholders.
- [x] Native links to Support, Privacy and Terms open their public `citylogger.app` pages.
- [x] iOS scene lifecycle configuration is included for current iOS SDKs, including deep-link forwarding.
- [x] The iOS project declares that it does not use non-exempt encryption.
- [x] Automated tests, TypeScript validation and the web/mobile production builds pass.

## Complete manually before resubmission

- [ ] Route `support@citylogger.app` to a monitored inbox and send a two-way test message.
- [ ] Publish the latest website version and confirm `/support`, `/privacy` and `/terms` work without signing in.
- [ ] Run `pnpm review:verify` with the private review credentials immediately before submission.
- [ ] Test the review account on a clean install of the exact replacement build on iPhone and iPad.
- [ ] Test password recovery, data export and account deletion using a disposable non-review account.
- [ ] Archive and upload build **1.0 (5)** or later from Xcode; never reuse reviewed build 1.0 (4).
- [ ] In Xcode Organizer, inspect the generated privacy report and resolve any warnings.
- [ ] Confirm the final archive contains no development server URL and connects to production Supabase.

## App Store Connect — required metadata corrections

### App Review Information

- [ ] Enable **Sign-in required**.
- [ ] Enter the dedicated review-account email in **User name**.
- [ ] Enter its unchanged password in **Password**. Never put the password in source control or Review Notes.
- [ ] Paste the review notes below.

### Age Rating

- [ ] Open **App Information → Age Rating**.
- [ ] Set **Age Assurance** to **None**.
- [ ] Set **Parental Controls** to **None** unless those controls are actually added later.
- [ ] Save and confirm that the answers accurately describe the submitted binary.

### URLs and privacy

- [ ] Replace the previous **Support URL** with `https://citylogger.app/support`.
- [ ] Set **Privacy Policy URL** to `https://citylogger.app/privacy`.
- [ ] Complete and publish App Privacy answers for data used by CityLogger and its providers.
- [ ] The expected disclosures include email address, user ID, optional name, private user content and service/security diagnostics; all are used for app functionality or security and are not used for tracking.
- [ ] Record accessibility support accurately; do not claim features that have not been tested.
- [ ] Complete export-compliance questions consistently with `ITSAppUsesNonExemptEncryption = false` and standard HTTPS/TLS use.

## Paste-ready App Review notes

CityLogger uses an optional private account to save and synchronise travel data. A dedicated, email-confirmed review account is provided in the User name and Password fields above. It does not use MFA, one-time codes or require access to an email inbox.

To sign in: launch the app, tap **Profile** in the bottom bar, tap **Create account or sign in**, choose **I already have an account**, then enter the supplied credentials.

After sign-in:

- **Map** shows 10 rated visited-city markers and 5 smaller purple Want to Visit markers.
- **Rankings** contains a manually ordered 10-city ranking; use the ordering controls to change it.
- **Log** contains visits across multiple years. Tap a city to see its category ratings, dates, visit type and note.
- **Lists** contains Want to Visit, Best food cities and Most underrated. Compare Cities is available in this section.
- **Profile** shows yearly-goal progress plus data export and account deletion.

All saved content is private to the review account. Please do not delete the supplied review account; the deletion control can be inspected in **Profile → Account & Privacy**. Product support is available at `https://citylogger.app/support`.

## Final reply to Apple

Use the response in [`docs/app-review-response.md`](app-review-response.md) only after every relevant manual checkbox above is complete.
