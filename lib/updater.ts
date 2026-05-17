const REPO = "zayan-builds/tempo-timer";
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const ASSET_NAME = "dist.zip";
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
      signal: ctrl.signal,
      headers: {
        Accept: "application/vnd.github+json",
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

  // Use stored version only if it was written after a confirmed OTA set().
  // Fresh install (builtin bundle) → "0.0.0" so GitHub release always appears newer.
  let currentVersion = "0.0.0";
  const stored = await getStoredVersion();
  console.log("[updater] stored version:", stored ?? "(none — treating as 0.0.0)");
  if (stored) {
    currentVersion = stored;
  } else if (CapacitorUpdater) {
    try {
      const cur = await CapacitorUpdater.current();
      const fromBundle = (cur as unknown as { bundle?: { version?: string } }).bundle?.version;
      console.log("[updater] CapacitorUpdater.current() =>", JSON.stringify(cur));
      if (fromBundle && fromBundle !== "builtin") currentVersion = stripV(fromBundle);
    } catch (e) {
      console.log("[updater] current() failed", e);
    }
  }
  console.log("[updater] currentVersion:", currentVersion);
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

  const rawTag = release.tag_name || "";
  const latest = stripV(rawTag);
  console.log("[updater] release tag_name (raw):", rawTag, "=> stripped:", latest);
  console.log("[updater] release assets:", (release.assets || []).map((a) => a.name));
  if (!latest) {
    setStatus({ error: "no tag on release", done: true });
    return;
  }
  setStatus({ latest });

  const cmp = compareVersions(latest, currentVersion);
  console.log(`[updater] VERSION COMPARE: latest="${latest}" vs current="${currentVersion}" => "${cmp}"`);
  setStatus({ compare: cmp });

  if (cmp !== "newer") {
    console.log("[updater] no update needed, skipping download");
    setStatus({ download: "skipped", done: true });
    return;
  }
  console.log("[updater] update available — proceeding to download");

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
    console.log("[updater] calling download() url:", downloadUrl, "version:", latest);
    const bundle = await CapacitorUpdater.download({
      url: downloadUrl,
      version: latest,
    });
    console.log("[updater] download() returned:", JSON.stringify(bundle));
    if (!bundle?.id) {
      console.log("[updater] ERROR: bundle has no id — aborting");
      setStatus({ download: "failed", error: "no bundle id", done: true });
      return;
    }
    console.log("[updater] calling set() with bundle.id:", bundle.id);
    await CapacitorUpdater.set({ id: bundle.id });
    console.log("[updater] set() returned successfully");
    await setStoredVersion(latest);
    console.log("[updater] stored version updated to:", latest);
    setStatus({ download: "ok", done: true });
    console.log("[updater] calling reload()");
    try {
      await CapacitorUpdater.reload();
      console.log("[updater] reload() called — app should restart");
    } catch (e) {
      console.log("[updater] reload() failed (bundle will apply on next launch):", e);
    }
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.log("[updater] FATAL download/apply error:", msg);
    setStatus({ download: "failed", error: msg, done: true });
  }
}
