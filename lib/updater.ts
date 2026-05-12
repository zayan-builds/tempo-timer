const REPO = "zayan-builds/tempo-timer";
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const ASSET_NAME = "dist.zip";
const FALLBACK_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
const PREF_VERSION_KEY = "tempo.installedVersion";

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

async function getStoredVersion(): Promise<string | null> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: PREF_VERSION_KEY });
    return value ? stripV(value) : null;
  } catch (e) {
    console.log("[updater] preferences get failed", e);
    return null;
  }
}

async function setStoredVersion(version: string) {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: PREF_VERSION_KEY, value: stripV(version) });
  } catch (e) {
    console.log("[updater] preferences set failed", e);
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } finally {
    clearTimeout(t);
  }
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

  // Determine current version: prefer Preferences (set on every successful apply),
  // fall back to CapacitorUpdater.current(), then NEXT_PUBLIC_APP_VERSION.
  let currentVersion = stripV(FALLBACK_VERSION);
  const stored = await getStoredVersion();
  if (stored) {
    currentVersion = stored;
  } else if (CapacitorUpdater) {
    try {
      const cur = await CapacitorUpdater.current();
      const fromBundle = (cur as unknown as { bundle?: { version?: string } }).bundle?.version;
      if (fromBundle) currentVersion = stripV(fromBundle);
      console.log("[updater] CapacitorUpdater.current() =>", cur);
    } catch (e) {
      console.log("[updater] current() failed", e);
    }
  }
  // Seed Preferences on first run so future checks are stable.
  if (!stored) await setStoredVersion(currentVersion);
  setStatus({ current: currentVersion });

  // Fetch release manifest with cache-busting and timeout.
  let release: GitHubRelease | null = null;
  const cacheBuster = `?t=${Date.now()}`;
  try {
    const url = RELEASES_URL + cacheBuster;
    console.log("[updater] fetching", url);
    const res = await fetchWithTimeout(url, 10000);
    console.log("[updater] GitHub status", res.status);
    if (!res.ok) {
      setStatus({ error: `GitHub HTTP ${res.status}`, done: true });
      return;
    }
    release = (await res.json()) as GitHubRelease;
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.log("[updater] fetch failed:", msg);
    setStatus({ error: `fetch: ${msg}`, done: true });
    return;
  }

  const latest = stripV(release.tag_name || "");
  console.log("[updater] release", {
    tag: release.tag_name,
    assets: (release.assets || []).map((a) => a.name),
  });
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

  // Locate dist.zip — fall back to the well-known direct path if the asset enumeration is empty.
  const apiAsset = (release.assets || []).find((a) => a.name === ASSET_NAME);
  let downloadUrl = apiAsset?.browser_download_url;
  if (!downloadUrl) {
    downloadUrl = `https://github.com/${REPO}/releases/download/v${latest}/${ASSET_NAME}`;
    console.log("[updater] api missing asset, trying fallback url", downloadUrl);
  }
  setStatus({ assetFound: true });

  if (!CapacitorUpdater) {
    setStatus({ error: "plugin unavailable", download: "skipped", done: true });
    return;
  }

  setStatus({ download: "pending" });
  try {
    console.log("[updater] downloading bundle", latest, downloadUrl);
    const bundle = await CapacitorUpdater.download({
      url: downloadUrl,
      version: latest,
    });
    console.log("[updater] download result", bundle);
    if (!bundle?.id) {
      setStatus({ download: "failed", error: "no bundle id", done: true });
      return;
    }
    console.log("[updater] applying bundle", bundle.id);
    await CapacitorUpdater.set({ id: bundle.id });
    await setStoredVersion(latest);
    console.log("[updater] set() complete, reloading…");
    setStatus({ download: "ok", done: true });
    try {
      await CapacitorUpdater.reload();
    } catch (e) {
      console.log("[updater] reload() failed (will apply on next launch)", e);
    }
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.log("[updater] download/apply failed:", msg);
    setStatus({ download: "failed", error: msg, done: true });
  }
}
