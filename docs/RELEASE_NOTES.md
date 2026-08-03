# Tempo v0.1.20 — Release notes (Play / GitHub)

## English (paste into Play release)

* Fixed the app icon — removed the dark inner frame for a clean, single cube on
  pure black across the launcher, web, and Play Store.
* New monochrome pixel-cube logo in a clean black adaptive icon.
* Export now saves your history straight to **Downloads** as a .json file
  (native MediaStore — no share sheet, no lost files).
* Import is hardened — fixes the "invalid JSON" error on exported files and
  skips malformed entries gracefully.
* Faster, richer stats insights with a corrected comparison engine (accurate
  averages, milestones, and near-PB detection).
* Smoother tap feel and a calmer, cleaner timer glow.
* Undo is now a floating pill at the bottom, easier to reach after a delete.
* Better touch targets across settings for reliable tapping.

## What's new (developer summary)

- **Icon fix** (`scripts/generate-icons.cjs`, `logo-cube.png`): the source
  squircle was rgb(44,44,44) — not pure black — which produced a visible inner
  rounded frame ("double squircle") on every icon. The pipeline now composites
  **only the cube** on pure black everywhere (adaptive foreground 100% inside the
  safe circle, verified; opaque legacy/round launcher icons; Play Store 512; web
  icons; favicon). Old logo assets removed from the repo.
- **Version**: 0.1.20 / versionCode 21, targetSdk 36.

Carried from 0.1.19:

- **Native Downloads plugin** (`DownloadsPlugin.java`): `MediaStore.Downloads`
  on API 29+, legacy public path on API 24–28 behind `WRITE_EXTERNAL_STORAGE`
  (maxSdk 28, runtime request only at export time).
- **Import hardening** (`lib/export.ts`): UTF-8 BOM strip, object-or-array
  acceptance, tolerant entry parsing with per-file error reporting.
- **Comparison engine** (`lib/comparison.ts`): absolute deltas for consistent
  streaks, includes the just-completed solve in milestone/first-solve counts,
  `>=` milestone thresholds, 0.01s floor on delta formatting, trimmed ao5/ao12
  matching on-screen averages, and a variance-scaled near-PB window.
- **Bloom** (`components/Bloom.tsx`): gradient-only glow (no banding filter),
  intent-calibrated opacities (idle .14 / armed .30 pulsing / running .09 /
  stopped .18 / pb .42 + halo).
- **Polish** (`History.tsx`, `Settings.tsx`, `lib/haptics.ts`): bottom-anchored
  undo pill, 44px touch targets on export/import/accent dots/hold options,
  `gentleImpact` 8ms.
- **Play compliance** (`PRIVACY_POLICY.md`, Settings → privacy policy link, `docs/PLAY_RELEASE.md`):
  no data collected, local-only storage, live HTTPS policy URL for Play Console, and a full
  2026 submission checklist (closed testing 12/14, target API 36, Data safety, IARC, contact).

## Artifacts

- `tempo-v0.1.20.aab` — Play upload
- `tempo-v0.1.20.apk` — signed APK (V2, CN=Syed Zayan)
- `dist.zip` — Capgo OTA web bundle (+ `dist.zip.sha256`)
