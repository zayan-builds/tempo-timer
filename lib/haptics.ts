export type HapticKind = "armed" | "start" | "stop" | "pb";

const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  armed: [15, 10, 15],
  start: 8,
  stop: [20, 15, 40],
  pb: [10, 8, 10, 8, 10, 8, 60],
};

let nativeModule: typeof import("@capacitor/haptics") | null = null;
let preloadPromise: Promise<typeof import("@capacitor/haptics") | null> | null = null;

// Kick off the dynamic import once at startup so the first interaction
// never waits on module resolution (and so haptics fire every time).
export function preloadHaptics(): Promise<typeof import("@capacitor/haptics") | null> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    if (typeof window === "undefined") return null;
    try {
      const mod = await import("@capacitor/haptics");
      nativeModule = mod;
      return mod;
    } catch {
      // WebView without the plugin — fall back to navigator.vibrate.
      return null;
    }
  })();
  return preloadPromise;
}

async function getNative(): Promise<typeof import("@capacitor/haptics") | null> {
  return preloadHaptics();
}

function webVibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /**/
  }
}

// Settings / gentle UI touches — intentionally softer than the timer's
// armed/start/stop taps.
export async function gentleImpact(): Promise<void> {
  const native = await getNative();
  if (native) {
    try {
      await native.Haptics.vibrate({ duration: 4 });
      return;
    } catch {
      /* fall through to web */
    }
  }
  webVibrate(4);
}

export async function lightImpact(): Promise<void> {
  const native = await getNative();
  if (native) {
    try {
      await native.Haptics.impact({ style: native.ImpactStyle.Light });
      return;
    } catch {
      /* fall through to web */
    }
  }
  webVibrate(10);
}

export async function triggerHaptic(kind: HapticKind): Promise<void> {
  const native = await getNative();
  if (!native) {
    webVibrate(WEB_PATTERNS[kind]);
    return;
  }
  try {
    switch (kind) {
      case "armed":
        await native.Haptics.impact({ style: native.ImpactStyle.Light });
        return;
      case "start":
        await native.Haptics.impact({ style: native.ImpactStyle.Medium });
        return;
      case "stop":
        await native.Haptics.impact({ style: native.ImpactStyle.Heavy });
        return;
      case "pb":
        await native.Haptics.notification({ type: native.NotificationType.Success });
        return;
    }
  } catch {
    webVibrate(WEB_PATTERNS[kind]);
  }
}
