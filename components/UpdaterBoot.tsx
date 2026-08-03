"use client";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { checkForUpdate, notifyReady } from "@/lib/updater";

const CHECK_DELAY = 1200;

export function UpdaterBoot() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!Capacitor.isNativePlatform()) {
      console.log("[updater] not native — skipping");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Critical path: confirm this bundle launched successfully immediately.
    // Never delayed behind the update check, so an OTA bundle can't be
    // rolled back by the plugin's 10s app-ready timeout.
    void notifyReady();

    // Deferred, non-blocking: check for a newer release.
    timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await checkForUpdate();
      } catch (e) {
        console.warn("[updater] update check failed", e);
      }
    }, CHECK_DELAY);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
