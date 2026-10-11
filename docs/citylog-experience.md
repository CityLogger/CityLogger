# CityLog experience update

## Platform scope

The refined visual system is mobile-app-only. `mobile/src/main.tsx` loads
`src/frontend/modern.css` after the existing native styles. The website does not
load that stylesheet and retains its sidebar, map container, category bar and
desktop layout. `experience.css` styles the new shared onboarding and City Story
features without replacing the website's overall visual system.

User-facing branding is CityLog (CITYLOG in the welcome wordmark). The domain,
support email, Supabase configuration, package name, bundle identifier and
`citylogger://auth` callback are intentionally unchanged.

## First-time experience

- New signed-out visitors see Create account, Sign in and Continue as guest.
- Guests and new registrations see LOG, RATE and COMPARE cards, with swipe,
  previous/next, three progress dots and Skip.
- Skip leads to the final statement, not past it. Start Your Map fades out the
  introduction over the real map.
- Completion is remembered locally. Existing signed-in accounts go straight to
  their map. Profile → Account & Privacy can replay the introduction.
- Email verification remains enabled; onboarding does not bypass authentication.

## Guest journal and cloud transfer

Guest visits, wishlist, lists, ranking order and goals use the versioned
`citylog-guest-journal-v1` local-storage key. No service-role credentials are used.
Local storage is not a backup: clearing app/browser data removes guest records.

After sign-in, an explicit **Save it to my account** action transfers guest data
through the existing authenticated backend and row-level-security policies.
Stable visit/list IDs allow a failed transfer to be retried without creating new
copies. The local journal is removed only after all operations and the subsequent
cloud reload succeed. Existing cloud ranking/goal preferences take precedence
where the account already has content. Signing in alone does not upload data.

## Repeat visits and City Story

No destructive database migration is needed: `visits` already uses independent
UUIDs and permits multiple visits to one city. New visits insert new records;
editing updates only the selected visit ID.

`journey.ts` groups visits by normalised city name and country, matching the
existing city-search identity. It derives one latest-visit summary per city for
the map, rankings and comparison. The Log retains every visit. The City Story
shows both the latest overall rating and individually selectable historic logs.
Deleting a visit does not delete the city's other visits.

Photos have not been re-enabled. The story has an optional existing-image slot,
but the current account model does not load photograph attachments or offer an
upload control. There is no new photo storage cost or permission request.

## Validation and release handoff

- Automated tests cover grouping, history, old-visit edits and deletion fallback.
- Browser checks cover local logging, repeat visits, old-visit editing, reload
  persistence, wishlist, lists, comparison, onboarding and compact phone layouts.
- Production mobile/web builds and Capacitor sync must pass before handoff.
- A browser viewport is not an iOS simulator. Validate the new build in Xcode on
  iPhone and iPad, including actual touch swipes, keyboard/safe areas, auth email
  callbacks, guest-to-cloud transfer and cross-device reload.
- Increment the Xcode build number and archive a replacement build. Website
  deployment does not update an already installed native app.
- App Store Connect's app name, screenshots, review notes and any external email
  sender branding remain manual account settings; they are not changed by code.
