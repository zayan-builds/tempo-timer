# Tempo v0.1.22 — Release notes (Play / GitHub)

## English (paste into Play release)

* **Native file restore** — backup files now open through Android's real
  system file picker and are read natively; no more web-view fallback. You see
  a "restore backup?" preview (filename, size, solve count) before anything
  changes, and cancelled or unreadable picks are handled gracefully.
* **Encryption, verified** — Settings shows exactly how much of your history
  is encrypted at rest (e.g. "30 of 34 solves"), with a "verify key" button
  that runs a real on-device round-trip check. If verification ever fails,
  you'll know immediately — no silent data loss.
* **Sharper launcher icon** — the cube artwork now renders pixel-exact and
  full-bleed, fully inside the safe zone on every device, with a new
  monochrome layer for Android 13+ themed icons.
* **Buttons that feel right** — every button, toggle, and delete action now
  responds to a real press gesture (trigger on release, not on touch), shows
  a pressed state, and settles with subtle haptics.
* **Toggle polish** — the matrix scramble label now animates through random
  glyphs while switching, with fixed-width text so nothing jumps.

## What's new (developer summary)

- **Native import** (`android/app/src/main/java/com/zayan/tempo/JsonPickerPlugin.java`,
  `MainActivity.java`, `lib/native-json-picker.ts`, `lib/export.ts`): new
  `JsonPickerPlugin` uses `ACTION_OPEN_DOCUMENT` + native UTF-8 read; the stale
  WebView file-input path is bypassed on Android. TS bridge `pickJsonFile()`
  returns `{picked, cancelled}`; `readFileText` reads via `arrayBuffer` +
  `TextDecoder` (more reliable than `file.text()` on Android).
- **Staged import UI** (`components/Settings.tsx`): `handleFileSelected` →
  `stageImport` shows a "restore backup?" panel (filename, KB, count) with
  import/cancel; `confirmImport` applies it. Redesigned `NotePanel` (dot
  indicator, error/neutral colors, maxHeight 52).
- **Encryption verification** (`lib/crypto.ts`, `hooks/useHistory.ts`):
  `cryptoSelfTest()` (AES-GCM round-trip probe) + `hasStoredKey()`; `useHistory`
  exposes `stats {total, encrypted}` refreshed on add/delete/clear/import;
  Settings shows "encrypted at rest — N of M solves" and a verify button
  ("key verified" / "verify failed" / "checking…") that auto-runs when the
  lock sheet opens with encryption on.
- **Toggle animation** (`components/Settings.tsx`): matrix scramble label
  animates through random glyphs (36 ms interval, 380 ms burst); fixed-width
  label stops layout shift.
- **Tap semantics** (`lib/tap.ts`, `components/Settings.tsx`,
  `components/History.tsx`): new `useTap()` hook — pointerup activation, 12 px
  move tolerance, 500 ms duration guard, `pressed` state. Wired into
  `PillButton` (0.10/0.10 border spec, 0.08 inactive, height 40, radius 10,
  120 ms/220 ms spring-settle press), Settings Toggle, verify button, History
  delete strip, and the undo pill (gentleImpact haptic + press scale).
- **Launcher icon** (`scripts/generate-icons.cjs`): new pipeline renders the
  exact artwork full-bleed for legacy/Play/web; adaptive foreground
  pixel-exact inside the 72 dp mask (max-safe fraction 0.4571 → 100.0%, 0 px
  clipped — old build clipped 1.6% of corners); proper 108 dp sizing
  (`m.size * 108/48`); monochrome layer wired into both adaptive XMLs;
  `drawable-v24/ic_launcher_foreground.xml` and `logo-cube.png` removed.
- **Version**: 0.1.22 / versionCode 23, targetSdk 36.

## Artifacts

- `tempo-v0.1.22.aab` — Play upload
- `tempo-v0.1.22.apk` — signed APK (V2, CN=Syed Zayan)
- `dist.zip` — Capgo OTA web bundle (+ `dist.zip.sha256`)
