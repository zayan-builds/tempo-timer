const RELEASES_URL =
  "https://api.github.com/repos/zayan-builds/tempo-timer/releases/latest";
const ASSET_NAME = "dist.zip";
const FALLBACK_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";

type GitHubAsset = { name: string; browser_download_url: string };
type GitHubRelease = { tag_name?: string; assets?: GitHubAsset[] };

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(/[.\-+]/)
    .map((n) => {
      const x = parseInt(n, 10);
      return Number.isFinite(x) ? x : 0;
    });
}

function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

export async function checkForUpdate(): Promise<void> {
  console.log("[updater] checkForUpdate start");
  try {
    const mod = await import("@capgo/capacitor-updater");
    const { CapacitorUpdater } = mod;

    let currentVersion = FALLBACK_VERSION;
    try {
      const cur = await CapacitorUpdater.current();
      console.log("[updater] CapacitorUpdater.current() =>", cur);
      const fromBundle =
        (cur as unknown as { bundle?: { version?: string } }).bundle?.version;
      const fromNative = (cur as unknown as { native?: string }).native;
      currentVersion = fromBundle || FALLBACK_VERSION || fromNative || "0.0.0";
    } catch (e) {
      console.log("[updater] current() failed, using fallback", e);
      currentVersion = FALLBACK_VERSION;
    }
    console.log("[updater] currentVersion =", currentVersion);

    const res = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    console.log("[updater] GitHub status", res.status);
    if (!res.ok) {
      console.log("[updater] GitHub fetch not ok, aborting");
      return;
    }
    const release = (await res.json()) as GitHubRelease;
    console.log("[updater] GitHub release", {
      tag: release.tag_name,
      assets: (release.assets || []).map((a) => a.name),
    });
    const tag = (release.tag_name || "").replace(/^v/i, "");
    if (!tag) {
      console.log("[updater] no tag on release");
      return;
    }
    const newer = isNewer(tag, currentVersion);
    console.log(`[updater] compare tag=${tag} current=${currentVersion} newer=${newer}`);
    if (!newer) return;

    const asset = (release.assets || []).find((a) => a.name === ASSET_NAME);
    console.log("[updater] dist.zip asset found?", !!asset, asset?.browser_download_url);
    if (!asset?.browser_download_url) return;

    console.log("[updater] downloading bundle", tag);
    const bundle = await CapacitorUpdater.download({
      url: asset.browser_download_url,
      version: tag,
    });
    console.log("[updater] download result", bundle);

    if (!bundle?.id) {
      console.log("[updater] no bundle id, aborting set()");
      return;
    }

    console.log("[updater] applying bundle", bundle.id);
    await CapacitorUpdater.set({ id: bundle.id });
    console.log("[updater] set() complete — reload pending");
  } catch (err) {
    console.log("[updater] fatal", err);
  }
}
