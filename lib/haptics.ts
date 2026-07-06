export type HapticKind = "armed" | "start" | "stop" | "pb";

const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  armed: [15, 10, 15],
  start: 8,
  stop: [20, 15, 40],
  pb: [10, 8, 10, 8, 10, 8, 60],
};

let cachedHaptics: typeof import("@capacitor/haptics") | null = null;
let nativeUnavailable = false;

async function getNative() {
  if (nativeUnavailable) return null;
  if (cachedHaptics) return cachedHaptics;
  try {
    const mod = await import("@capacitor/haptics");
    cachedHaptics = mod;
    return mod;
  } catch {
    nativeUnavailable = true;
    return null;
  }
}

function webFallback(kind: HapticKind) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(WEB_PATTERNS[kind]);
  } catch {}
}

export async function gentleImpact(): Promise<void> {
  try { navigator.vibrate(5); } catch {}
}

export async function lightImpact(): Promise<void> {
  const native = await getNative();
  if (!native) {
    try { navigator.vibrate(10); } catch {}
    return;
  }
  try {
    await native.Haptics.impact({ style: native.ImpactStyle.Light });
  } catch {
    try { navigator.vibrate(10); } catch {}
  }
}

export async function triggerHaptic(kind: HapticKind): Promise<void> {
  const native = await getNative();
  if (!native) {
    webFallback(kind);
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
    webFallback(kind);
  }
}
