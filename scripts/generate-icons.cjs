const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const LOGO = path.resolve(__dirname, "..", "New Logo.png");
const RES = path.resolve(__dirname, "..", "android", "app", "src", "main", "res");
const PUBLIC = path.resolve(__dirname, "..", "public");

// Android mipmap densities: canvas size, safe-zone ratio (inner safeZone)
// Adaptive icon: 108dp viewport, 72dp safe zone = 66.67%
const SAFE_ZONE = 2 / 3;

const mipmaps = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

async function main() {
  const logo = sharp(LOGO);
  const meta = await logo.metadata();
  console.log(`Logo: ${meta.width}x${meta.height}`);

  // Get raw RGBA pixels
  const { data, info } = await logo
    .resize(Math.round(meta.width * 4), Math.round(meta.height * 4), { kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Find bounding box of non-transparent content
  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  console.log(`Content bounds: ${contentW}x${contentH} at (${minX},${minY})`);

  // Function to generate foreground icon with safe-zone padding
  async function generateForeground(canvasSize, outPath) {
    const safeSize = Math.round(canvasSize * SAFE_ZONE);
    const padding = Math.round((canvasSize - safeSize) / 2);

    // Resize logo to fit within safe zone (leave 10% inner margin)
    const logoInSafe = Math.round(safeSize * 0.85);
    const resized = await sharp(LOGO)
      .resize(logoInSafe, logoInSafe, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create canvas and composite centered
    const canvas = Buffer.alloc(canvasSize * canvasSize * 4, 0);
    const offsetX = Math.round((canvasSize - resized.info.width) / 2);
    const offsetY = Math.round((canvasSize - resized.info.height) / 2);

    for (let y = 0; y < resized.info.height; y++) {
      for (let x = 0; x < resized.info.width; x++) {
        const srcIdx = (y * resized.info.width + x) * 4;
        const dstIdx = ((offsetY + y) * canvasSize + (offsetX + x)) * 4;
        // alpha blend: keep whatever sharp gave us
        canvas[dstIdx] = resized.data[srcIdx];
        canvas[dstIdx + 1] = resized.data[srcIdx + 1];
        canvas[dstIdx + 2] = resized.data[srcIdx + 2];
        canvas[dstIdx + 3] = resized.data[srcIdx + 3];
      }
    }

    await sharp(canvas, { raw: { width: canvasSize, height: canvasSize, channels: 4 } })
      .png()
      .toFile(outPath);
    console.log(`  Wrote ${outPath} (${canvasSize}x${canvasSize})`);
  }

  // Generate mipmap foregrounds
  console.log("\nGenerating mipmap foregrounds...");
  for (const m of mipmaps) {
    const outPath = path.join(RES, m.dir, "ic_launcher_foreground.png");
    await generateForeground(m.size, outPath);
  }

  // Also generate ic_launcher.png (fallback for pre-API26)
  console.log("\nGenerating mipmap launcher icons (fallback)...");
  for (const m of mipmaps) {
    const outPath = path.join(RES, m.dir, "ic_launcher.png");
    // For fallback, use same foreground (transparent bg) — user has black bg everywhere
    const srcPath = path.join(RES, m.dir, "ic_launcher_foreground.png");
    fs.copyFileSync(srcPath, outPath);
    console.log(`  Copied ${outPath}`);
  }

  // Generate public icons
  console.log("\nGenerating web icons...");
  for (const size of [192, 512]) {
    const outPath = path.join(PUBLIC, `icon-${size}.png`);
    await sharp(LOGO)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`  Wrote ${outPath} (${size}x${size})`);
  }

  // Generate favicon (48x48 PNG)
  const faviconPath = path.join(PUBLIC, "favicon.ico");
  await sharp(LOGO)
    .resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(faviconPath);
  console.log(`  Wrote ${faviconPath} (48x48)`);

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
