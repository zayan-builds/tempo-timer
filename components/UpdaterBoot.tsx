"use client";
import { useEffect, useState } from "react";
import { checkForUpdate, subscribeUpdater, UpdaterStatus } from "@/lib/updater";

export function UpdaterBoot() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    subscribeUpdater((s) => {
      if (cancelled) return;
      setStatus(s);
      setVisible(true);
      if (hideTimer) clearTimeout(hideTimer);
      // Keep visible at least 5s; reset on each status patch.
      hideTimer = setTimeout(() => setVisible(false), 5000);
    });

    (async () => {
      try {
        const mod = await import("@capgo/capacitor-updater");
        if (cancelled) return;
        await mod.CapacitorUpdater.notifyAppReady();
        console.log("[updater] notifyAppReady ok");
      } catch (e) {
        console.log("[updater] notifyAppReady failed (likely web)", e);
      }
      // Run on every launch — no skip conditions.
      void checkForUpdate();
    })();

    return () => {
      cancelled = true;
      if (hideTimer) clearTimeout(hideTimer);
      subscribeUpdater(null);
    };
  }, []);

  if (!visible || !status) return null;

  const line = (k: string, v: string | undefined) =>
    v ? (
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.5 }}>{k}</span>
        <span>{v}</span>
      </div>
    ) : null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        right: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        border: "1px solid rgba(245,240,232,0.18)",
        borderRadius: 8,
        padding: "10px 12px",
        color: "#F5F0E8",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        lineHeight: 1.5,
        pointerEvents: "none",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div style={{ opacity: 0.7, letterSpacing: "0.18em", marginBottom: 4 }}>UPDATER</div>
      {line("current", status.current)}
      {line("latest", status.latest)}
      {line("compare", status.compare)}
      {status.assetFound !== undefined && line("dist.zip", status.assetFound ? "found" : "missing")}
      {line("download", status.download)}
      {status.error && line("error", status.error)}
    </div>
  );
}
