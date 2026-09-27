# CityLogger iOS handoff

CityLogger uses Capacitor to package the shared React interface as a native iOS
application. The hosted Vinext build is unchanged.

## What is committed

- `mobile/` contains the static mobile entry point.
- `vite.mobile.config.ts` builds the native web bundle into `dist-mobile/`.
- `capacitor.config.ts` defines the app as `com.citylogger.app`.
- `ios/` is the generated Xcode project.

Generated web files inside `dist-mobile/` and `ios/App/App/public/` are ignored.
Run a sync whenever the shared web application changes.

## Build and sync

From the repository root:

```bash
pnpm install
pnpm mobile:sync
```

The mobile build reads the same `NEXT_PUBLIC_SUPABASE_*` variables as the hosted
application. Create a local `.env.local` from `.env.example` before building accounts
into the native app. Never place a Supabase service-role key in this file.

## Open on a Mac

Install a current Xcode release, clone the GitHub repository, then run:

```bash
pnpm install
pnpm mobile:sync
pnpm mobile:open
```

In Xcode:

1. Select the **App** target.
2. Open **Signing & Capabilities** and select the Apple Developer team.
3. Confirm that `com.citylogger.app` is registered and available.
4. Replace the generated app icon and splash assets.
5. Run on an iPhone simulator and a physical iPhone.


## Current iOS SDK scene lifecycle compatibility

The current Xcode/iOS SDK requires the UIKit scene-based lifecycle. The generated
Capacitor project has therefore been updated to support `UIScene` rather than relying
only on the older application lifecycle.

The native iOS project intentionally includes these changes:

- `ios/App/App/SceneDelegate.swift` implements `UIWindowSceneDelegate` and must remain
  included in the Xcode **App** target.
- `AppDelegate.swift` returns the `Default Configuration` scene configuration from
  `application(_:configurationForConnecting:options:)`.
- `Info.plist` contains a `UIApplicationSceneManifest` for
  `UIWindowSceneSessionRoleApplication`, using `Default Configuration`,
  `$(PRODUCT_MODULE_NAME).SceneDelegate`, and the existing `Main` storyboard.

These changes fixed a launch failure where the current iOS SDK reported that the
`UIScene` lifecycle was required. Do not remove or overwrite them when updating or
regenerating the Capacitor iOS project without first verifying that the generated
project provides equivalent scene lifecycle support.

## Before TestFlight

- Deploy the Supabase schema and account-deletion function.
- Configure an iOS-compatible authentication callback/deep link.
- Complete the Xcode privacy manifest and permission descriptions for every
  native plugin used.
- Review the App Store privacy answers against the final data flow.
- Archive in Xcode and upload the validated build to App Store Connect.
