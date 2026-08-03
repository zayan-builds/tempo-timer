# Play Console Release Guide — Tempo v0.1.21

Everything needed to push `com.zayan.tempo` (versionCode 22) to Google Play.

## 1. Upload artifact

| File | Path |
|---|---|
| AAB (upload to Play) | `tempo-v0.1.21.aab` |
| Signed APK (sideload/test) | `tempo-v0.1.21.apk` |

Both are signed with the release keystore (`android/app/tempo-keystore`, cert CN=Syed Zayan,
SHA-256 `506a4ae5fb3206be2aaef44fcd868c1fa6491f894321d7a9ead1bd414ec304d4`). To regenerate:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
& .\android\gradlew.bat -p android bundleRelease --console=plain   # -> app-release.aab
& .\android\gradlew.bat -p android assembleRelease --console=plain # -> app-release.apk
```

## 2. App identity

- **App name:** Tempo
- **Package name:** `com.zayan.tempo`
- **Version:** 0.1.21 (versionCode 22)
- **minSdk:** 24 (Android 7.0) — covers ~95%+ of active devices
- **targetSdk / compileSdk:** 36

## 3. Permissions (declare in Play Console)

| Permission | Why | Play declaration |
|---|---|---|
| `INTERNET` | Capgo OTA update checks + release notes link | Declare (default) |
| `VIBRATE` | Haptic feedback on timer tap/start/stop | Declare |
| `USE_BIOMETRIC` + `USE_FINGERPRINT` | Optional app-lock via device biometrics | Declare (legacy fingerprint alias for old devices) |
| `WRITE_EXTERNAL_STORAGE` (`maxSdkVersion=28`) | Exporting history to Downloads on Android 7–9 only | Declare. API 29+ uses scoped `MediaStore.Downloads` and **never** requests it |

No other runtime permissions. The storage permission is requested only on Android 7–9, at the
moment the user taps **Export**, and only grants the *export* (no read access is requested).

## 4. Data safety form

- **No data collected:** Tempo stores all solves, settings, and history locally on-device only
  (Capacitor Preferences / device storage). Nothing is transmitted to a server you don't control.
- **Networking:** The Capgo updater pings Capgo's servers to check for OTA builds; it sends no
  user data, only the app version. Set "other transmitted data — none" and optionally note
  "diagnostics — none".
- **Deletion:** Because data is local-only, uninstalling the app deletes everything. Export to
  Downloads is the user's own copy. No in-app deletion-request flow required.
- **Security:** All data is device-local; optional lock is enforced by OS biometrics.

### Declared permissions list for the form
`android.permission.INTERNET` (network), `android.permission.VIBRATE` (haptics),
`android.permission.WRITE_EXTERNAL_STORAGE` (files), `android.permission.USE_BIOMETRIC` /
`USE_FINGERPRINT` (biometric auth).

## 5. Content rating

Complete the IARC questionnaire. Tempo is a puzzle/tool app: no violence, sexual content,
gambling, purchases, or ads. Expect **Everyone** (E). Tap "no" for every content category
except possibly "sharing location" — answer no.

## 6. Target audience & store listing

- **Category:** Tools (as configured in the Play Console). A speed-cube timer also fits "Puzzle" / "Productivity → Timer" if you ever want to switch.
- **Target audience:** All ages. Do **not** enable "designed for families / kids" unless you
  want COPPA compliance — keep it as a general audience app.
- Suggest adding: privacy policy (see §8), screenshots (4+), a feature graphic (1024x500),
  and a 512x512 store icon (use `public/playstore-icon-512.png`).

## 7. Uploading the AAB (production)

1. Play Console → your app → **Production** → **Create new release** (or **Test tracks** first
   for a staged rollout — closed testing with internal testers is recommended for the first release).
2. Upload `tempo-v0.1.21.aab`.
3. Release notes (English) — see `RELEASE_NOTES.md`.
4. Save → review. The versionCode must be **higher** than any previous internal/closed/beta
   build (22 is the current max).
5. Roll out to a small percentage first (staged rollout) if uncertain.

> ⚠️ Play Console **App signing**: the first uploaded AAB's upload key registers Play App
> Signing. Subsequent updates must be signed with the *same* keystore (or re-registered). Keep
> `android/app/tempo-keystore` safe — losing it blocks future updates once App Signing is on.

## 8. Privacy policy

Required for every app (live HTTPS URL, must load on mobile — a document download link is
**not** accepted).

- **URL to enter in Play Console:**
  `https://github.com/zayan-builds/tempo-timer/blob/main/PRIVACY_POLICY.md`
  (repo-root `PRIVACY_POLICY.md` — it must exist on `main`, so push first, then submit).
- In-app link: Settings → **privacy policy** (bottom of the sheet) opens the same page.
- Alternative if you ever want a branded URL: host the same markdown on Vercel/GitHub Pages
  and swap the link in `components/Settings.tsx` (`openPrivacy`).

Policy summary: no data collected, all data local-only, no accounts, uninstall deletes
everything, Capgo updater transmits only the app version.

## 9. Compliance checklist (2026)

Tempo is **policy-clean for submission** except the Play Console forms themselves:

- **Target API level — DONE.** Google's 2026 floor is API 35; Tempo targets **36**.
- **Data safety form — do in console.** Complete under App content → Data safety. Declare
  "no data collected"; the Capgo updater must be noted (it transmits your app version).
  The form must match `PRIVACY_POLICY.md` (they are consistent).
- **Permissions — declare in console.** INTERNET, VIBRATE, WRITE_EXTERNAL_STORAGE
  (maxSdk 28), USE_BIOMETRIC, USE_FINGERPRINT. In-app disclosure: the storage prompt only
  fires on Android 7–9 at export time, under the user's explicit tap.
- **Content rating — do in console.** IARC questionnaire; expect "Everyone".
- **Contact email — real, monitored.** Play uses it for policy issues.
- **Privacy policy URL — see §8.** Must be live *before* submitting the form/release.
- **Account deletion URL — not applicable.** No accounts; local-only data is removed on
  uninstall (stated in policy §4).
- **Closed testing for new personal accounts (created after Nov 13, 2023).** You **cannot
  go straight to Production**. You must: publish to the **Closed testing** track, get
  **12+ opted-in testers on physical devices** (no emulators), keep it running **14 days**,
  then request production access. Account created earlier but never shipped → also required.
- **Feature graphic (1024×500)** and **512×512 store icon** (`public/playstore-icon-512.png`)
  for the listing.
- **Store listing copy must match the build.** Don't claim features that aren't shipped.
- **Play Integrity / SafetyNet — not used.** We don't gate features on device attestation.
- **Policy 4.3 (webview minimum functionality) — compliant.** Capacitor wrapper plus real
  native functionality (haptics, storage, biometrics, downloads plugin) passes by design.

## 10. Common rejection pitfalls

- **Icon:** The launcher icon must not use transparency outside the safe zone. Our adaptive
  foreground keeps the cube 100% inside the safe circle (verified), and `playstore-icon-512.png`
  is opaque. Play Protect may show a stale icon on old installs — uninstall before testing.
- **Version code:** never lower than a previously uploaded code (use 22+, not 21).
- **Target SDK:** 36 is required for new updates — already set.
- **Permissions:** don't claim the storage permission in the listing; it's maxSdk 28 only.

## 11. OTA note (Capgo)

The web build (`dist.zip`) is published separately as a GitHub release asset and delivered via
Capgo updater. Play builds ship their own bundled web assets, so the store release doesn't
depend on Capgo being reachable — but do not bump `capacitor.config.ts` version without a real
Capgo build to match.
