const RELEASES_URL =
  "https://api.github.com/repos/zayan-builds/tempo-timer/releases/latest";
const ASSET_NAME = "dist.zip";

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
  try {
    const mod = await import("@capgo/capacitor-updater");
    const { CapacitorUpdater } = mod;

    // Get the version of the currently active bundle. Native-only.
    let currentVersion = "0.0.0";
    try {
      const cur = await CapacitorUpdater.current();
      // Shape varies by plugin version; both `.bundle.version` and `.native` exist.
      const fromBundle =
        (cur as unknown as { bundle?: { version?: string } }).bundle?.version;
      const fromNative = (cur as unknown as { native?: string }).native;
      currentVersion = fromBundle || fromNative || "0.0.0";
    } catch {
      return; // Not running natively — bail silently.
    }

    const res = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const release = (await res.json()) as GitHubRelease;
    const tag = (release.tag_name || "").replace(/^v/i, "");
    if (!tag) return;
    if (!isNewer(tag, currentVersion)) return;

    const asset = (release.assets || []).find((a) => a.name === ASSET_NAME);
    if (!asset?.browser_download_url) return;

    const bundle = await CapacitorUpdater.download({
      url: asset.browser_download_url,
      version: tag,
    });

    if (!bundle?.id) return;

    await CapacitorUpdater.set({ id: bundle.id });
  } catch {
    // Silent fail: no network, no native plugin, malformed release, etc.
  }
}
