const REPO = "zayan-builds/tempo-timer";
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const ASSET_NAME = "dist.zip";
const SHA_ASSET_NAME = "dist.zip.sha256";
const PREF_VERSION_KEY = "tempo.installedVersion";
const BUNDLED_VERSION = stripV(process.env.NEXT_PUBLIC_APP_VERSION || "0.1.20");

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const MAX_FETCH_RETRIES = 3;
const FETCH_RETRY_DELAY = [2000, 4000, 8000];

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

export function stripV(s: string): string {
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

export function compareVersions(a: string, b: string): "same" | "newer" | "older" {
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

export async function clearStoredUpdaterVersion() {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key: PREF_VERSION_KEY });
  } catch (e) {
    console.log("[updater] preferences remove failed", e);
  }
}

// Critical-path: mark the currently running bundle as successfully launched.
// Per plugin docs this must be called on every launch, immediately, before any
// network work — otherwise an OTA bundle is rolled back after 10s.
export async function notifyReady(): Promise<void> {
  try {
    const mod = await import("@capgo/capacitor-updater");
    await mod.CapacitorUpdater.notifyAppReady();
    console.log("[updater] notifyAppReady ok");
  } catch (e) {
    console.warn("[updater] notifyAppReady failed", e);
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 10000, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: "application/vnd.github+json",
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

async function fetchReleaseWithRetry(url: string, attempt = 0): Promise<GitHubRelease> {
  try {
    const res = await fetchWithTimeout(url, 10000);
    console.log("[updater] GitHub status", res.status);
    if (!res.ok) {
      throw new Error(`GitHub HTTP ${res.status}`);
    }
    return (await res.json()) as GitHubRelease;
  } catch (e) {
    if (attempt < MAX_FETCH_RETRIES - 1) {
      const delay = FETCH_RETRY_DELAY[attempt] || 8000;
      console.log(`[updater] fetch attempt ${attempt + 1} failed, retrying in ${delay}ms`, e);
      await new Promise((r) => setTimeout(r, delay));
      return fetchReleaseWithRetry(url, attempt + 1);
    }
    throw e;
  }
}

async function fetchSha256(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return /^[0-9a-fA-F]{64}$/.test(text) ? text.toLowerCase() : null;
  } catch {
    return null;
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

  if (!CapacitorUpdater) {
    setStatus({ error: "plugin unavailable", download: "skipped", done: true });
    return;
  }

  let currentVersion = "0.0.0";
  try {
    const cur = await CapacitorUpdater.current();
    const fromBundle = (cur as unknown as { bundle?: { version?: string } }).bundle?.version;
    console.log("[updater] CapacitorUpdater.current() =>", JSON.stringify(cur));
    if (fromBundle && fromBundle !== "builtin") currentVersion = stripV(fromBundle);
  } catch (e) {
    console.log("[updater] current() failed, using 0.0.0", e);
  }

  const stored = await getStoredVersion();
  console.log("[updater] stored version:", stored ?? "(none)");
  if (stored && compareVersions(stored, currentVersion) === "newer") {
    currentVersion = stored;
  }

  console.log("[updater] currentVersion:", currentVersion);
  setStatus({ current: currentVersion });

  let release: GitHubRelease | null = null;
  const cacheBuster = `?t=${Date.now()}`;
  try {
    const url = RELEASES_URL + cacheBuster;
    console.log("[updater] fetching", url);
    release = await fetchReleaseWithRetry(url);
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.log("[updater] fetch failed:", msg);
    setStatus({ error: `fetch: ${msg}`, done: true });
    return;
  }

  const rawTag = release.tag_name || "";
  const latest = stripV(rawTag);
  console.log("[updater] release tag_name (raw):", rawTag, "=> stripped:", latest);

  if (!latest) {
    setStatus({ error: "no tag on release", done: true });
    return;
  }

  if (!VERSION_RE.test(latest)) {
    setStatus({ error: `invalid version format: ${latest}`, done: true });
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

  const apiAsset = (release.assets || []).find((a) => a.name === ASSET_NAME);
  let downloadUrl = apiAsset?.browser_download_url;
  if (!downloadUrl) {
    downloadUrl = `https://github.com/${REPO}/releases/download/v${latest}/${ASSET_NAME}`;
    console.log("[updater] api missing asset, trying fallback url", downloadUrl);
  }
  setStatus({ assetFound: Boolean(apiAsset) });

  // Integrity: fetch the matching sha256 (published alongside dist.zip).
  const shaAsset = (release.assets || []).find((a) => a.name === SHA_ASSET_NAME);
  const shaUrl =
    shaAsset?.browser_download_url || `https://github.com/${REPO}/releases/download/v${latest}/${SHA_ASSET_NAME}`;
  const checksum = await fetchSha256(shaUrl);
  console.log("[updater] checksum:", checksum ? checksum.slice(0, 16) + "…" : "(none)");

  setStatus({ download: "pending" });
  try {
    console.log("[updater] calling download() url:", downloadUrl, "version:", latest);
    const bundle = await CapacitorUpdater.download({
      url: downloadUrl,
      version: latest,
      ...(checksum ? { checksum } : {}),
    });
    console.log("[updater] download() returned:", JSON.stringify(bundle));
    if (!bundle?.id) {
      console.log("[updater] ERROR: bundle has no id — aborting");
      setStatus({ download: "failed", error: "no bundle id", done: true });
      return;
    }

    // Schedule for the next app launch — no forced reload, Play-compliant.
    // The running session stays untouched; if the new bundle ever fails to
    // start, notifyAppReady is not called and the plugin auto-rolls back.
    console.log("[updater] calling next() with bundle.id:", bundle.id);
    await CapacitorUpdater.next({ id: bundle.id });
    console.log("[updater] next() scheduled bundle for next launch");
    await setStoredVersion(latest);
    console.log("[updater] stored version updated to:", latest);
    setStatus({ download: "ok", done: true });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.log("[updater] FATAL download/apply error:", msg);
    setStatus({ download: "failed", error: msg, done: true });
  }
}
