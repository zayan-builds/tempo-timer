const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "..", "out");

const REQUIRED_FILES = ["index.html", "_next/static/chunks"];
const REQUIRED_EXTENSIONS = [".html", ".js", ".css", ".json", ".png", ".ico"];

let failed = false;

function check(condition, msg) {
  if (!condition) {
    console.error("FAIL:", msg);
    failed = true;
  } else {
    console.log("OK:", msg);
  }
}

function main() {
  console.log("Verifying dist output at", DIST);

  if (!fs.existsSync(DIST)) {
    console.error("FAIL: out/ directory does not exist");
    process.exit(1);
  }

  // Check index.html
  check(fs.existsSync(path.join(DIST, "index.html")), "index.html exists");

  // Check _next/static/chunks directory
  const chunksDir = path.join(DIST, "_next/static/chunks");
  check(fs.existsSync(chunksDir), "_next/static/chunks exists");

  // Check for flat structure — no nested out/out/
  const nestedOut = path.join(DIST, "out");
  check(!fs.existsSync(nestedOut), "no nested out/out/ directory");

  // Check manifest.json
  const manifestPath = path.join(DIST, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      check(!!manifest.name, "manifest.json has name");
      check(!!manifest.icons?.length, "manifest.json has icons");
    } catch (e) {
      check(false, "manifest.json is valid JSON");
    }
  } else {
    check(false, "manifest.json exists");
  }

  // Check icons exist at expected paths
  const icon192 = path.join(DIST, "icon-192.png");
  const icon512 = path.join(DIST, "icon-512.png");
  check(fs.existsSync(icon192), "icon-192.png exists");
  check(fs.existsSync(icon512), "icon-512.png exists");

  // Count all resource files
  let totalFiles = 0;
  let totalSize = 0;
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile()) {
        totalFiles++;
        totalSize += fs.statSync(full).size;
      }
    }
  }
  walk(DIST);
  console.log(`Total files: ${totalFiles}`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  check(totalFiles > 10, `at least 10 files (got ${totalFiles})`);
  check(totalSize > 50000, `total size > 50KB (got ${totalSize} bytes)`);

  if (failed) {
    console.error("\n❌ dist verification FAILED");
    process.exit(1);
  } else {
    console.log("\n✅ dist verification passed");
  }
}

main();
