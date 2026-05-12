const RELEASES_URL =
  "https://api.github.com/repos/zayan-builds/tempo-timer/releases/latest";
const ASSET_NAME = "dist.zip";
const FALLBACK_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";

type GitHubAsset = { name: string; browser_download_url: string };
type GitHubRelease = { tag_name?: string; assets?: GitHubAsset[] };

export type UpdaterStatus = {
  current?: string;
  latest?: string;
  compare?: "same" | "newer" | "older" | "unknown";
  assetFound?: boolean;
  download?: "idle" | "pending" | "ok" | "failed" | "skipped";
  error?: string;
  done?: boolean;
};

type Listener = (s: UpdaterStatus) => void;
let listener: Listener | null = null;
let lastStatus: UpdaterStatus = { download: "idle" };

export function subscribeUpdater(fn: Listener | null) {
  listener = fn;
  if (fn) fn(lastStatus);
}

function setStatus(patch: Partial<UpdaterStatus>) {
  lastStatus = { ...lastStatus, ...patch };
  console.log("[updater] status", lastStatus);
  if (listener) listener(lastStatus);
}

function stripV(s: string): string {
  return s.replace(/^v/i, "").trim();
}

function parseVersion(v: string): number[] {
  return stripV(v)
    .split(/[.\-+]/)
    .map((n) => {
      const x = parseInt(n, 10);
      return Number.isFinite(x) ? x : 0;
    });
}

function compareVersions(a: string, b: string): "same" | "newer" | "older" {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av > bv) return "newer";
    if (av < bv) return "older";
  }
  return "same";
}

export async function checkForUpdate(): Promise<void> {
  console.log("[updater] checkForUpdate start");
  setStatus({ download: "idle", error: undefined, done: false });

  let CapacitorUpdater: typeof import("@capgo/capacitor-updater").CapacitorUpdater | null = null;
  try {
    const mod = await import("@capgo/capacitor-updater");
    CapacitorUpdater = mod.CapacitorUpdater;
    console.log("[updater] plugin loaded");
  } catch (e) {
    console.log("[updater] plugin import failed", e);
  }

  let currentVersion = FALLBACK_VERSION;
  if (CapacitorUpdater) {
    try {
      const cur = await CapacitorUpdater.current();
      console.log("[updater] CapacitorUpdater.current() =>", cur);
      const fromBundle = (cur as unknown as { bundle?: { version?: string } }).bundle?.version;
      currentVersion = stripV(fromBundle || FALLBACK_VERSION);
    } catch (e) {
      console.log("[updater] current() failed, using fallback", e);
      currentVersion = stripV(FALLBACK_VERSION);
    }
  } else {
    currentVersion = stripV(FALLBACK_VERSION);
  }
  setStatus({ current: currentVersion });

  let release: GitHubRelease;
  try {
    const url = `${RELEASES_URL}?t=${Date.now()}`;
    console.log("[updater] fetching", url);
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache",
      },
    });
    console.log("[updater] GitHub status", res.status);
    if (!res.ok) {
      setStatus({ error: `GitHub ${res.status}`, done: true });
      return;
    }
    release = (await res.json()) as GitHubRelease;
  } catch (e) {
    console.log("[updater] fetch failed", e);
    setStatus({ error: "fetch failed", done: true });
    return;
  }

  const latest = stripV(release.tag_name || "");
  console.log("[updater] release", { tag: release.tag_name, assets: (release.assets || []).map((a) => a.name) });
  if (!latest) {
    setStatus({ error: "no tag on release", done: true });
    return;
  }
  setStatus({ latest });

  const cmp = compareVersions(latest, currentVersion);
  console.log(`[updater] compare latest=${latest} current=${currentVersion} => ${cmp}`);
  setStatus({ compare: cmp });

  if (cmp !== "newer") {
    setStatus({ download: "skipped", done: true });
    return;
  }

  const asset = (release.assets || []).find((a) => a.name === ASSET_NAME);
  const assetFound = !!asset?.browser_download_url;
  console.log("[updater] dist.zip asset found?", assetFound, asset?.browser_download_url);
  setStatus({ assetFound });
  if (!asset?.browser_download_url) {
    setStatus({ error: "no dist.zip", download: "failed", done: true });
    return;
  }

  if (!CapacitorUpdater) {
    setStatus({ error: "plugin unavailable", download: "skipped", done: true });
    return;
  }

  setStatus({ download: "pending" });
  try {
    console.log("[updater] downloading bundle", latest);
    const bundle = await CapacitorUpdater.download({
      url: asset.browser_download_url,
      version: latest,
    });
    console.log("[updater] download result", bundle);
    if (!bundle?.id) {
      setStatus({ download: "failed", error: "no bundle id", done: true });
      return;
    }
    console.log("[updater] applying bundle", bundle.id);
    await CapacitorUpdater.set({ id: bundle.id });
    console.log("[updater] set() complete, reloading…");
    setStatus({ download: "ok", done: true });
    try {
      await CapacitorUpdater.reload();
    } catch (e) {
      console.log("[updater] reload() failed (will apply on next launch)", e);
    }
  } catch (e) {
    console.log("[updater] download/apply failed", e);
    setStatus({ download: "failed", error: String(e), done: true });
  }
}
