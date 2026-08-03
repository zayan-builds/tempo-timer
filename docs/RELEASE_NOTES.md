# Tempo v0.1.21 — Release notes (Play / GitHub)

## English (paste into Play release)

* New **Daily Accent** engine — a unique color for every day of the year, tuned
  to stay muted and premium on black. The old accent repeated every week; now a
  color never returns until a full year has passed.
* **Brighter launcher icon** — the cube's side faces were nearly invisible on
  pure black; every face is now legible while the pixel-art edges stay crisp.
* **Calmer timer glow** — the bloom behind the timer is now a diffuse haze
  instead of a bright globe, in every state (idle, armed, running, stopped, PB).
* **Smother swipe-to-delete** — swiping a history row now springs open to a
  tappable delete action with a bouncy return; a full swipe still deletes in one
  gesture.
* **Redesigned export/import buttons** — crisp hairline buttons with a springy
  press, instead of plain text links.
* **Share is now reliable** — sharing never fails silently, and history no
  longer gets locked out if biometrics become unavailable (falls back to your
  PIN).
* **Smarter import** — clearer messages for empty, malformed, or non-tempo
  files, and the share card's glow renders correctly in the exported image.

## What's new (developer summary)

- **365-day accent engine** (`lib/settings.tsx`): replaced the
  `getDay()`-keyed 7-color table (colors repeated every week) with a
  golden-angle (137.508°) hue walk over day-of-year — day 1..365 each get a
  distinct hue (verified: 365 unique, evenly named). Exposed via
  `getDailyAccent()` / `getDailyAccentName()`; Info copy updated.
- **Icon contrast** (`scripts/generate-icons.cjs`): added a luma lift
  ([56..248] → [136..250]) on the cube's opaque pixels so the dark side faces
  read against pure black; regenerated all icon surfaces, verified 0% clip risk.
- **Bloom** (`components/Bloom.tsx`): center peak 0.9 → 0.38, longer falloff,
  reduced radii/opacities per state — reads as a diffuse haze, never a globe.
- **Swipe-to-delete** (`components/History.tsx`): springy snap-open
  (`cubic-bezier(0.34,1.56,0.64,1)`) to a tappable red delete button
  (`SNAP_OPEN` 56px), full-swipe commit still flies the row out; bouncy return.
- **Buttons** (`components/Settings.tsx`): new `PillButton` (Apple/Linear-style
  — translucent fill, hairline border, uppercase micro-label, springy press);
  applied to export (filled/accent) and import (ghost). Empty export now shows a
  hint instead of silently doing nothing.
- **Share reliability** (`components/History.tsx`): `navigator.canShare` wrapped
  in try/catch (throws TypeError on file-sharing-less WebViews) with a guaranteed
  download fallback.
- **Lock fallback** (`components/TimerScreen.tsx`): if biometric auth is
  unavailable or fails, history now falls back to the PIN pad when a PIN exists
  (`hasPin`) — no more permanently locked-out history.
- **Share card bloom** (`components/ShareCard.tsx`): replaced `filter: blur(60px)`
  (renders inconsistently in dom-to-image-more) with a layered radial gradient.
- **Import/export polish** (`lib/export.ts`, `components/Settings.tsx`):
  friendlier messages ("the file is empty — try exporting from tempo again",
  "no solves found in this file", …); file-read errors surface the underlying
  message.
- **Version**: 0.1.21 / versionCode 22, targetSdk 36.

## Artifacts

- `tempo-v0.1.21.aab` — Play upload
- `tempo-v0.1.21.apk` — signed APK (V2, CN=Syed Zayan)
- `dist.zip` — Capgo OTA web bundle (+ `dist.zip.sha256`)
