const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// ─────────────────────────────────────────────────────────────────────────────
// THE one icon source: logo-source.png — the user's own 512×512 artwork.
// Opaque pure-black canvas with the pixel cube at ~67%, centered. This exact
// composition is used FULL-BLEED for legacy launcher icons (Android 7), the
// Play Store icon, and web icons. For the adaptive foreground (Android 8+),
// the cube is extracted and scaled to the LARGEST size that fits inside the
// 72dp device-mask circle with ZERO clipping — computed pixel-exact, not
// guessed. Background layer is solid black, so the masked result reads
// identically to the source artwork.
// ─────────────────────────────────────────────────────────────────────────────
const LOGO = path.resolve(__dirname, "..", "logo-source.png");
const RES = path.resolve(__dirname, "..", "android", "app", "src", "main", "res");
const PUBLIC = path.resolve(__dirname, "..", "public");

// Device masks may be up to 72dp in diameter; canvas is 108dp.
const MASK_RADIUS_DP = 36;
const CANVAS_DP = 108;

const mipmaps = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

// The source is fully opaque; the cube is the only non-black content. Pull it
// out onto a transparent canvas by dropping near-black pixels.
const BG_LUMA = 16;

async function extractCube() {
  const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  const out = Buffer.alloc(W * H * 4);
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const l = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (l >= BG_LUMA) {
        out[i] = data[i];
        out[i + 1] = data[i + 1];
        out[i + 2] = data[i + 2];
        out[i + 3] = 255;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX) throw new Error("no cube pixels found in source");
  const trimmed = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
  const artW = maxX - minX + 1, artH = maxY - minY + 1;

  // Pixel-exact max scale: every opaque pixel must sit within the mask circle.
  // Normalized coords relative to art width; distance = frac * 108 * sqrt(nx²+ny²).
  let Rmax = 0;
  for (let y = 0; y < artH; y++) {
    for (let x = 0; x < artW; x++) {
      if (trimmed[(y * artW + x) * 4 + 3] < 200) continue;
      const nx = (x + 0.5 - artW / 2) / artW;
      const ny = (y + 0.5 - artH / 2) / artW;
      const r = Math.hypot(nx, ny);
      if (r > Rmax) Rmax = r;
    }
  }
  const fracMax = MASK_RADIUS_DP / (CANVAS_DP * Rmax);
  const frac = Math.min(fracMax * 0.985, 0.61);
  console.log(`Cube: ${artW}x${artH} (aspect ${(artW / artH).toFixed(3)})`);
  console.log(`  max pixel radius (norm): ${Rmax.toFixed(4)} -> max safe frac ${fracMax.toFixed(4)}`);
  console.log(`  adaptive frac used: ${frac.toFixed(4)} (clamped ≤ 0.61)`);
  return { trimmed, artW, artH, frac };
}

async function placeOnCanvas(artPng, canvasSize, frac) {
  const artSize = Math.round(canvasSize * frac);
  const resized = await sharp(artPng)
    .resize(artSize, artSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const canvas = Buffer.alloc(canvasSize * canvasSize * 4);
  const offset = Math.round((canvasSize - resized.info.width) / 2);
  const src = resized.data, srcW = resized.info.width;
  for (let y = 0; y < srcW; y++) {
    for (let x = 0; x < srcW; x++) {
      const si = (y * srcW + x) * 4;
      const a = src[si + 3];
      if (a < 4) continue;
      const di = ((offset + y) * canvasSize + (offset + x)) * 4;
      const fa = a / 255;
      canvas[di] = Math.round(src[si] * fa);
      canvas[di + 1] = Math.round(src[si + 1] * fa);
      canvas[di + 2] = Math.round(src[si + 2] * fa);
      canvas[di + 3] = a;
    }
  }
  return sharp(canvas, { raw: { width: canvasSize, height: canvasSize, channels: 4 } }).png().toBuffer();
}

async function fullBleed(size) {
  return sharp(LOGO).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } }).png().toBuffer();
}

async function main() {
  const srcMeta = await sharp(LOGO).metadata();
  console.log(`Source: logo-source.png ${srcMeta.width}x${srcMeta.height} alpha=${srcMeta.hasAlpha}`);
  if (!srcMeta.hasAlpha) console.log("  (opaque black canvas — used full-bleed for unmasked surfaces)");

  const { trimmed, artW, artH, frac } = await extractCube();
  const trimmedBuf = await sharp(trimmed).png().toBuffer();

  // ── Adaptive foregrounds (transparent bg, cube at max-safe frac) ──
  console.log("\nAdaptive foregrounds + monochrome...");
  const monoData = await sharp(trimmed).ensureAlpha().raw().toBuffer();
  {
    for (let i = 0; i < monoData.length; i += 4) {
      if (monoData[i + 3] > 0) { monoData[i] = monoData[i + 1] = monoData[i + 2] = 255; }
    }
  }
  const monoArt = await sharp(monoData, { raw: { width: artW, height: artH, channels: 4 } }).png().toBuffer();

  for (const m of mipmaps) {
    // Foreground layer is 108dp; legacy mipmap size = 48dp at that density.
    const fgSize = Math.round(m.size * (108 / 48));
    const fg = await placeOnCanvas(trimmedBuf, fgSize, frac);
    const mono = await placeOnCanvas(monoArt, fgSize, frac);
    await sharp(fg).png().toFile(path.join(RES, m.dir, "ic_launcher_foreground.png"));
    await sharp(mono).png().toFile(path.join(RES, m.dir, "ic_launcher_monochrome.png"));
    console.log(`  ${m.dir}: fg+mono ${fgSize}px (${m.size}px legacy)`);
  }

  // ── Legacy launcher icons — full-bleed source (user's exact composition) ──
  console.log("\nLegacy launcher icons (full-bleed)...");
  for (const m of mipmaps) {
    const png = await fullBleed(m.size);
    const a = path.join(RES, m.dir, "ic_launcher.png");
    await sharp(png).toFile(a);
    fs.copyFileSync(a, path.join(RES, m.dir, "ic_launcher_round.png"));
    console.log(`  ${a} + round (${m.size}x${m.size})`);
  }

  // ── Play Store 512 (opaque, exact source) ──
  console.log("\nPlay Store + web icons...");
  await sharp(LOGO).png().toFile(path.join(PUBLIC, "playstore-icon-512.png"));
  console.log("  playstore-icon-512.png (512x512, opaque)");
  for (const size of [512, 192]) {
    await sharp(await fullBleed(size)).toFile(path.join(PUBLIC, `icon-${size}.png`));
    console.log(`  icon-${size}.png`);
  }
  await sharp(await fullBleed(48)).toFile(path.join(PUBLIC, "favicon.ico"));
  console.log("  favicon.ico (48x48)");

  // ── Verification ──
  console.log("\nVerifying...");
  {
    const { data, info } = await sharp(path.join(RES, "mipmap-xxxhdpi", "ic_launcher_foreground.png")).raw().toBuffer({ resolveWithObject: true });
    const S = info.width, cx = S / 2, cy = S / 2;
    const R = (MASK_RADIUS_DP / CANVAS_DP) * S;
    let inside = 0, outside = 0, maxR = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const a = data[(y * S + x) * 4 + 3];
      if (a < 180) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= R) inside++; else { outside++; if (d > maxR) maxR = d; }
    }
    console.log(`  adaptive fg: opaque px inside 72dp circle = ${inside} (${(inside / (inside + outside) * 100).toFixed(4)}%), outside = ${outside}`);
    if (outside > 0) console.log(`  !! max outside radius: ${(maxR / S * CANVAS_DP).toFixed(2)}dp (mask is ${MASK_RADIUS_DP * 2}dp)`);
  }
  for (const p of [path.join(PUBLIC, "playstore-icon-512.png"), path.join(PUBLIC, "icon-512.png"), path.join(RES, "mipmap-xxxhdpi", "ic_launcher.png")]) {
    const meta = await sharp(p).metadata();
    const raw = await sharp(p).ensureAlpha().raw().toBuffer();
    let minA = 255;
    for (let i = 3; i < raw.length; i += 4) if (raw[i] < minA) minA = raw[i];
    console.log(`  ${path.basename(p)}: ${meta.width}x${meta.height} alpha=${meta.hasAlpha ? "yes" : "no"} minAlpha=${minA} ${minA === 255 ? "OPAQUE OK" : "NOT opaque"}`);
  }

  console.log("\nDone!");
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
