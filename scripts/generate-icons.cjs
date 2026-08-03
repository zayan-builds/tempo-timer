const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const LOGO = path.resolve(__dirname, "..", "New Logo.png");
const RES = path.resolve(__dirname, "..", "android", "app", "src", "main", "res");
const PUBLIC = path.resolve(__dirname, "..", "public");

// Adaptive icon: 108dp viewport, 66dp safe-zone circle = 61.1% of canvas.
// The cube's bright faces sit inside the safe circle with comfortable margin.
const APP_ICON_FRAC = 0.55; // cube bounding square as fraction of canvas (adaptive + legacy)
const FULLBLEED_FRAC = 0.72; // play store + web (displayed full-bleed, no mask crop)

const mipmaps = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

const BLACK_BG = { r: 0, g: 0, b: 0, a: 255 };

function isCreamLike(r, g, b, a) {
  // feathered/transparent edge, or warm cream background (red clearly above blue)
  if (a < 230) return true;
  return r - b >= 5 && r >= 195 && g >= 190 && b >= 180;
}

async function extractCube() {
  const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const alpha = (x, y) => data[(y * W + x) * 4 + 3];

  const isBg = (x, y) => {
    const i = (y * W + x) * 4;
    return isCreamLike(data[i], data[i + 1], data[i + 2], data[i + 3]);
  };

  // BFS flood fill from every border pixel through cream/feathered background
  const bg = new Uint8Array(W * H);
  const queue = [];
  const seed = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const idx = y * W + x;
    if (bg[idx] || !isBg(x, y)) return;
    bg[idx] = 1;
    queue.push(idx);
  };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
  for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
  while (queue.length) {
    const idx = queue.pop();
    const x = idx % W, y = (idx / W) | 0;
    if (x > 0 && !bg[idx - 1] && isBg(x - 1, y)) { bg[idx - 1] = 1; queue.push(idx - 1); }
    if (x < W - 1 && !bg[idx + 1] && isBg(x + 1, y)) { bg[idx + 1] = 1; queue.push(idx + 1); }
    if (y > 0 && !bg[idx - W] && isBg(x, y - 1)) { bg[idx - W] = 1; queue.push(idx - W); }
    if (y < H - 1 && !bg[idx + W] && isBg(x, y + 1)) { bg[idx + W] = 1; queue.push(idx + W); }
  }

  for (let i = 0; i < W * H; i++) {
    if (bg[i]) data[i * 4 + 3] = 0;
  }

  const src = sharp(data, { raw: { width: W, height: H, channels: 4 } });
  // trim transparent border so the cube is tight for sizing
  return src.trim().png().toBuffer({ resolveWithObject: true });
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

async function makeIcon(cubePng, canvasSize, frac, opaqueBase, outPath) {
  const cubeSize = Math.round(canvasSize * frac);
  const resized = await sharp(cubePng)
    .resize(cubeSize, cubeSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
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
  return { canvasSize, cubeSize };
}

function verifyOpaque(outPath, canvasSize) {
  // Assert the generated legacy/play icons are fully opaque (Play Store requirement).
  const png = fs.readFileSync(outPath);
  return png.subarray(png.length - 8).includes(Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]))
    ? "png ok"
    : "png?";
}

async function main() {
  const logoMeta = await sharp(LOGO).metadata();
  console.log(`Source logo: ${logoMeta.width}x${logoMeta.height} alpha=${logoMeta.hasAlpha}`);

  console.log("Extracting cube (removing cream/feathered background)...");
  const { data: cubePng, info: cubeInfo } = await extractCube();
  console.log(`Extracted cube: ${cubeInfo.width}x${cubeInfo.height}`);

  // ── Adaptive foregrounds (transparent, cube floats) ──
  console.log("\nGenerating adaptive foregrounds...");
  for (const m of mipmaps) {
    const out = path.join(RES, m.dir, "ic_launcher_foreground.png");
    await makeIcon(cubePng, m.size, APP_ICON_FRAC, false, out);
    console.log(`  ${out} (${m.size}x${m.size}, cube ${Math.round(m.size * APP_ICON_FRAC)}px)`);
  }

  // ── Legacy launcher icons (opaque black, pre-API 26 fallback) ──
  console.log("\nGenerating legacy launcher icons (opaque black)...");
  for (const m of mipmaps) {
    const a = path.join(RES, m.dir, "ic_launcher.png");
    const b = path.join(RES, m.dir, "ic_launcher_round.png");
    await makeIcon(cubePng, m.size, APP_ICON_FRAC, true, a);
    fs.copyFileSync(a, b);
    console.log(`  ${a} + round (${m.size}x${m.size})`);
  }

  // ── Play Store 512 (opaque, no alpha) ──
  console.log("\nGenerating Play Store icon...");
  const playOut = path.join(PUBLIC, "playstore-icon-512.png");
  await makeIcon(cubePng, 512, FULLBLEED_FRAC, true, playOut);
  console.log(`  ${playOut} (512x512, opaque)`);

  // ── Web / PWA icons (opaque) ──
  console.log("\nGenerating web icons...");
  for (const size of [512, 192]) {
    const out = path.join(PUBLIC, `icon-${size}.png`);
    await makeIcon(cubePng, size, FULLBLEED_FRAC, true, out);
    console.log(`  ${out} (${size}x${size})`);
  }
  const fav = path.join(PUBLIC, "favicon.ico");
  await makeIcon(cubePng, 48, 1.0, true, fav);
  console.log(`  ${fav} (48x48)`);

  // ── Verification ──
  console.log("\nVerifying generated icons...");
  const { data: fgData, info: fgInfo } = await sharp(
    path.join(RES, "mipmap-xxxhdpi", "ic_launcher_foreground.png"),
  ).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // fraction of bright content within safe circle (radius 0.3056 * canvas)
  const S = fgInfo.width;
  const cx = S / 2, cy = S / 2;
  const safeR = 0.3056 * S;
  let brightInside = 0, brightOutside = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = fgData[(y * S + x) * 4 + 3];
    if (a < 180) continue;
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= safeR) brightInside++; else brightOutside++;
  }
  const total = brightInside + brightOutside;
  console.log(`  adaptive foreground xxxhdpi: bright px inside safe circle = ${brightInside} (${total ? (brightInside / total * 100).toFixed(1) : 0}%), outside = ${brightOutside}`);
  const clippedPct = total ? (brightOutside / total * 100).toFixed(2) : "0";
  console.log(`  -> clipped-on-circle risk: ${clippedPct}% of bright pixels`);

  for (const p of [playOut, path.join(PUBLIC, "icon-512.png"), path.join(RES, "mipmap-xxxhdpi", "ic_launcher.png")]) {
    const meta = await sharp(p).metadata();
    const { data: d, info: inf } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minA = 255;
    for (let i = 3; i < d.length; i += 4) if (d[i] < minA) minA = d[i];
    console.log(`  ${path.basename(p)}: ${inf.width}x${inf.height} alpha=${meta.hasAlpha ? "yes" : "no"} minAlpha=${minA} ${minA === 255 ? "OPAQUE ✓" : "NOT opaque ✗"}`);
  }

  console.log("\nDone!");
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
