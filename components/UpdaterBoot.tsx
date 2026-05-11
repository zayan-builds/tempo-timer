"use client";
import { useEffect } from "react";
import { checkForUpdate } from "@/lib/updater";

export function UpdaterBoot() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const mod = await import("@capgo/capacitor-updater");
        if (cancelled) return;
        await mod.CapacitorUpdater.notifyAppReady();
        console.log("[updater] notifyAppReady ok");
      } catch (e) {
        console.log("[updater] notifyAppReady failed (likely web)", e);
        return;
      }

      timer = setTimeout(() => {
        if (cancelled) return;
        console.log("[updater] firing checkForUpdate after 3s delay");
        void checkForUpdate();
      }, 3000);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
}
