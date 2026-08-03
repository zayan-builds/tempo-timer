const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// v0.1.19: the crown — pixelated cube on a black squircle, background removed.
const LOGO = path.resolve(__dirname, "..", "tempo NEW logo.png");
const RES = path.resolve(__dirname, "..", "android", "app", "src", "main", "res");
const PUBLIC = path.resolve(__dirname, "..", "public");

// Adaptive icon: 108dp viewport, 66dp safe-zone circle = 61.1% of canvas.
// The cube is WIDE (aspect ~1.30) and spans ~99% of the squircle width, so the
// cube's WIDTH is the binding constraint. frac 0.55 => cube width ~54% of the
// canvas, safely inside the 61.1% mask circle.
const APP_ICON_FRAC = 0.55; // adaptive foreground + legacy launcher (masked)
const FULLBLEED_FRAC = 0.72; // play store + web (displayed full-bleed, no mask)

const mipmaps = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

const BLACK_BG = { r: 0, g: 0, b: 0, a: 255 };

async function extractArtwork() {
  const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  // Trim to the opaque bounding box (squircle + cube). The logo already has a
  // fully transparent background, so we just drop the empty margin.
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const src = sharp(data, { raw: { width: W, height: H, channels: 4 } });
  const { data: trimmed, info: tinfo } = await src
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data: trimmed, info: tinfo };
}

function blendSquare(src, srcW, srcH, dst, dstW, offsetX, offsetY, opaqueBase) {
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const si = (y * srcW + x) * 4;
      const sa = src[si + 3];
      if (sa === 0) continue;
      const dx = offsetX + x, dy = offsetY + y;
      if (dx < 0 || dy < 0 || dx >= dstW || dy >= dstW) continue;
      const di = (dy * dstW + dx) * 4;
      if (opaqueBase) {
        const fa = sa / 255;
        dst[di] = Math.round(src[si] * fa);
        dst[di + 1] = Math.round(src[si + 1] * fa);
        dst[di + 2] = Math.round(src[si + 2] * fa);
        dst[di + 3] = 255;
      } else {
        const fa = sa / 255;
        const oa = dst[di + 3] / 255;
        const outA = fa + oa * (1 - fa);
        if (outA <= 0) continue;
        dst[di] = Math.round((src[si] * fa + dst[di] * oa * (1 - fa)) / outA);
        dst[di + 1] = Math.round((src[si + 1] * fa + dst[di + 1] * oa * (1 - fa)) / outA);
        dst[di + 2] = Math.round((src[si + 2] * fa + dst[di + 2] * oa * (1 - fa)) / outA);
        dst[di + 3] = Math.round(outA * 255);
      }
    }
  }
}

async function makeIcon(artPng, canvasSize, frac, opaqueBase, outPath) {
  const artSize = Math.round(canvasSize * frac);
  const resized = await sharp(artPng)
    .resize(artSize, artSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const canvas = Buffer.alloc(canvasSize * canvasSize * 4);
  if (opaqueBase) {
    for (let i = 0; i < canvasSize * canvasSize; i++) {
      canvas[i * 4] = BLACK_BG.r;
      canvas[i * 4 + 1] = BLACK_BG.g;
      canvas[i * 4 + 2] = BLACK_BG.b;
      canvas[i * 4 + 3] = BLACK_BG.a;
    }
  }
  const offset = Math.round((canvasSize - resized.info.width) / 2);
  blendSquare(resized.data, resized.info.width, resized.info.height, canvas, canvasSize, offset, offset, opaqueBase);

  await sharp(canvas, { raw: { width: canvasSize, height: canvasSize, channels: 4 } })
    .png()
    .toFile(outPath);
  return { canvasSize, artSize };
}

async function main() {
  const logoMeta = await sharp(LOGO).metadata();
  console.log(`Source logo: ${logoMeta.width}x${logoMeta.height} alpha=${logoMeta.hasAlpha}`);

  const { data: artPng, info: artInfo } = await extractArtwork();
  console.log(`Trimmed artwork: ${artInfo.width}x${artInfo.height} (aspect ${(artInfo.width / artInfo.height).toFixed(3)})`);

  // ── Adaptive foregrounds (transparent, black squircle floats on black) ──
  console.log("\nGenerating adaptive foregrounds...");
  for (const m of mipmaps) {
    const out = path.join(RES, m.dir, "ic_launcher_foreground.png");
    await makeIcon(artPng, m.size, APP_ICON_FRAC, false, out);
    console.log(`  ${out} (${m.size}x${m.size}, art ${Math.round(m.size * APP_ICON_FRAC)}px)`);
  }

  // ── Legacy launcher icons (opaque black, pre-API 26 fallback) ──
  console.log("\nGenerating legacy launcher icons (opaque black)...");
  for (const m of mipmaps) {
    const a = path.join(RES, m.dir, "ic_launcher.png");
    const b = path.join(RES, m.dir, "ic_launcher_round.png");
    await makeIcon(artPng, m.size, APP_ICON_FRAC, true, a);
    fs.copyFileSync(a, b);
    console.log(`  ${a} + round (${m.size}x${m.size})`);
  }

  // ── Play Store 512 (opaque, no alpha) ──
  console.log("\nGenerating Play Store icon...");
  const playOut = path.join(PUBLIC, "playstore-icon-512.png");
  await makeIcon(artPng, 512, FULLBLEED_FRAC, true, playOut);
  console.log(`  ${playOut} (512x512, opaque)`);

  // ── Web / PWA icons (opaque) ──
  console.log("\nGenerating web icons...");
  for (const size of [512, 192]) {
    const out = path.join(PUBLIC, `icon-${size}.png`);
    await makeIcon(artPng, size, FULLBLEED_FRAC, true, out);
    console.log(`  ${out} (${size}x${size})`);
  }
  const fav = path.join(PUBLIC, "favicon.ico");
  await makeIcon(artPng, 48, 1.0, true, fav);
  console.log(`  ${fav} (48x48)`);

  // ── Verification ──
  console.log("\nVerifying generated icons...");
  const { data: fgData, info: fgInfo } = await sharp(
    path.join(RES, "mipmap-xxxhdpi", "ic_launcher_foreground.png"),
  ).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const S = fgInfo.width;
  const cx = S / 2, cy = S / 2;
  const safeR = 0.3056 * S;
  let inside = 0, outside = 0, cubeInside = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = fgData[(y * S + x) * 4 + 3];
    if (a < 180) continue;
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= safeR) { inside++; if ((fgData[(y * S + x) * 4] + fgData[(y * S + x) * 4 + 1] + fgData[(y * S + x) * 4 + 2]) / 3 > 80) cubeInside++; }
    else outside++;
  }
  const total = inside + outside;
  console.log(`  adaptive xxxhdpi: opaque px inside safe circle = ${inside} (${total ? (inside / total * 100).toFixed(1) : 0}%), outside = ${outside}`);
  console.log(`  cube (bright) px inside safe circle = ${cubeInside}`);
  console.log(`  -> clipped-on-circle risk: ${total ? (outside / total * 100).toFixed(2) : "0"}% of opaque px`);

  for (const p of [playOut, path.join(PUBLIC, "icon-512.png"), path.join(RES, "mipmap-xxxhdpi", "ic_launcher.png")]) {
    const meta = await sharp(p).metadata();
    const { data: d, info: inf } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minA = 255;
    for (let i = 3; i < d.length; i += 4) if (d[i] < minA) minA = d[i];
    console.log(`  ${path.basename(p)}: ${inf.width}x${inf.height} alpha=${meta.hasAlpha ? "yes" : "no"} minAlpha=${minA} ${minA === 255 ? "OPAQUE OK" : "NOT opaque"}`);
  }

  console.log("\nDone!");
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
