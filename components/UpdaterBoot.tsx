"use client";
import { useEffect } from "react";
import { checkForUpdate } from "@/lib/updater";

export function UpdaterBoot() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@capgo/capacitor-updater");
        if (cancelled) return;
        await mod.CapacitorUpdater.notifyAppReady();
      } catch {
        // Native plugin unavailable (running in a plain web browser).
        return;
      }
      if (cancelled) return;
      await checkForUpdate();
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
