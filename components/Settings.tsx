"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { ACCENT_HEX, AccentName, getDailyAccentName, useSettings } from "@/lib/settings";
import { exportSolves, parseImport, readFileText, downloadJson, pickJsonFile } from "@/lib/export";
import { Solve, useHistory } from "@/hooks/useHistory";
import { cryptoSelfTest } from "@/lib/crypto";
import { useTap } from "@/lib/tap";
import {
  clearAuth,
  isBiometricAvailable,
  registerBiometric,
  setPin,
  verifyBiometric,
} from "@/lib/auth";
import { sounds, unlockAudio } from "@/lib/sound";
import { gentleImpact } from "@/lib/haptics";
import { PinPad } from "./PinPad";

const ACCENT_ORDER: AccentName[] = [
  "amber", "blue", "green", "red", "purple", "white", "gold",
];

const ACCENT_LABELS: Record<string, string> = {
  amber: "amber",
  blue: "blue",
  green: "green",
  red: "red",
  purple: "purple",
  white: "white",
  gold: "gold",
};
const HOLD_OPTIONS: Array<{ value: 300 | 500 | 750; label: string }> = [
  { value: 300, label: "0.3s" },
  { value: 500, label: "0.5s" },
  { value: 750, label: "0.75s" },
];

const HAIRLINE = "1px solid rgba(245,240,232,0.08)";
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%!?[]{}\\^~<>*&=+";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SETTLE = "cubic-bezier(0.32, 0.72, 0, 1)";
const OFF_WIDTH = 3 * 12 + 2 * 12 * 0.3; // "off" at 12px, 0.3em tracking

function Row({
  label,
  children,
  withDivider = true,
  trailingLabel,
  labelFontSize = 13,
  animTick = 0,
  rowIndex = -1,
  accentHex = "#F5F0E8",
}: {
  label: string;
  children: React.ReactNode;
  withDivider?: boolean;
  trailingLabel?: React.ReactNode;
  labelFontSize?: number;
  animTick?: number;
  rowIndex?: number;
  accentHex?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 18,
        paddingBottom: 18,
        borderBottom: withDivider ? HAIRLINE : "none",
        gap: 16,
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span className="font-mono" style={{ fontSize: labelFontSize, letterSpacing: "0.16em", color: "#F5F0E8", opacity: 0.85, whiteSpace: "nowrap" }}>
          {label.split("").map((char, i) => {
            if (rowIndex < 0) return <span key={i}>{char}</span>;
            const startAt = 280 + rowIndex * 80 + i * 15;
            const resolveAt = startAt + 220;
            if (animTick < startAt) return <span key={i} style={{ opacity: 0 }}>{char}</span>;
            if (animTick >= resolveAt) return <span key={i}>{char}</span>;
            const rand = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
            return <span key={i} style={{ opacity: 0.75, color: accentHex }}>{rand}</span>;
          })}
        </span>
        {trailingLabel}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, accentHex }: { on: boolean; onChange: (v: boolean) => void; accentHex: string }) {
  const [scrambling, setScrambling] = useState(false);
  const [tick, setTick] = useState(0);
  const tap = useTap(() => {
    setScrambling(true);
    onChange(!on);
  });

  useEffect(() => {
    if (!scrambling) return;
    const iv = setInterval(() => setTick((t) => t + 1), 36);
    const to = setTimeout(() => setScrambling(false), 380);
    return () => {
      clearInterval(iv);
      clearTimeout(to);
    };
  }, [scrambling]);

  const label = on ? "on" : "off";
  const text = scrambling
    ? label
        .split("")
        .map(() => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)])
        .join("")
    : label;

  return (
    <button
      aria-label={on ? "enabled" : "disabled"}
      className="font-mono"
      style={{
        color: on ? accentHex : "#F5F0E8",
        opacity: scrambling ? 0.95 : on ? 1 : 0.4,
        fontSize: 12,
        letterSpacing: "0.3em",
        minWidth: OFF_WIDTH,
        display: "inline-flex",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "12px 0",
        margin: "-12px 0",
        touchAction: "manipulation",
      }}
      {...tap}
    >
      {text}
    </button>
  );
}

function SpeakerIcon({ size = 12, opacity = 0.4 }: { size?: number; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#F5F0E8" strokeOpacity={opacity} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#F5F0E8" fillOpacity={opacity * 0.6} />
      <path d="M15.5 8.5a4 4 0 0 1 0 7" />
    </svg>
  );
}

// Apple/Linear-style action button: translucent neutral fill, hairline border,
// tight radius, uppercase micro-label, springy press. No sharp filled shapes.
function PillButton({
  label,
  onClick,
  accentHex,
  variant = "ghost",
  dimmed = false,
}: {
  label: string;
  onClick: () => void;
  accentHex: string;
  variant?: "filled" | "ghost";
  dimmed?: boolean;
}) {
  const tap = useTap(() => {
    if (!dimmed) {
      void gentleImpact();
      onClick();
    }
  });
  const filled = variant === "filled";
  return (
    <button
      className="font-mono"
      aria-pressed={tap.pressed}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 40,
        padding: "0 18px",
        borderRadius: 10,
        background: filled
          ? accentHex
          : tap.pressed
            ? "rgba(245,240,232,0.10)"
            : "rgba(245,240,232,0.05)",
        color: filled ? "#000000" : "#F5F0E8",
        fontSize: 10.5,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        border: filled ? "none" : `1px solid rgba(245,240,232,${tap.pressed ? 0.16 : 0.10})`,
        cursor: dimmed ? "default" : "pointer",
        touchAction: "manipulation",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        opacity: dimmed ? 0.35 : 1,
        transform: tap.pressed ? "scale(0.97)" : "scale(1)",
        transition: `transform ${tap.pressed ? "120ms" : "220ms"} ${tap.pressed ? SPRING : SETTLE}, background 120ms ease, border-color 120ms ease, opacity 180ms ease, box-shadow 180ms ease, filter 120ms ease`,
        filter: filled && tap.pressed ? "brightness(0.9)" : "none",
        boxShadow: filled ? `0 6px 18px ${accentHex}2e, inset 0 0 0 0.5px rgba(0,0,0,0.12)` : "none",
      }}
      {...tap}
    >
      {label}
    </button>
  );
}

const ERROR_NOTE_STARTS = [
  "could not",
  "the file is empty",
  "not a valid",
  "this file doesn't",
  "no solves",
  "no valid",
  "import failed",
  "nothing to export",
];

function isErrorNote(label: string): boolean {
  return ERROR_NOTE_STARTS.some((p) => label.startsWith(p));
}

function NotePanel({
  note,
  accentHex,
}: {
  note: { label: string; detail?: string } | null;
  accentHex: string;
}) {
  const error = !!note && isErrorNote(note.label);
  return (
    <div
      className="font-mono"
      style={{
        overflow: "hidden",
        maxHeight: note ? 52 : 0,
        opacity: note ? 1 : 0,
        transition: "max-height 260ms ease, opacity 220ms ease",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        paddingLeft: 2,
        paddingRight: 2,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: error ? "#C0392B" : accentHex,
          marginTop: 4,
          flexShrink: 0,
          opacity: 0.9,
        }}
      />
      <span style={{ color: error ? "#E06C5C" : accentHex, fontSize: 9, letterSpacing: "0.14em", lineHeight: 1.6, minWidth: 0 }}>
        {note?.label ?? ""}
        {note?.detail && (
          <span style={{ color: "#F5F0E8", opacity: 0.4, marginLeft: 8, letterSpacing: "0.1em" }}>
            {note.detail}
          </span>
        )}
      </span>
    </div>
  );
}

export function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update, accentHex } = useSettings();
  const { solves, bulkImport, stats } = useHistory();
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [pinDisableOpen, setPinDisableOpen] = useState(false);
  const [authToast, setAuthToast] = useState<string | null>(null);
  const [proTip, setProTip] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{ label: string; detail?: string } | null>(null);
  const [importNote, setImportNote] = useState<{ label: string; detail?: string } | null>(null);
  const [importStage, setImportStage] = useState<{ name: string; size: number; count: number; solves: Solve[] } | null>(null);
  const [verifyState, setVerifyState] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [animTick, setAnimTick] = useState(0);
  const animStartRef = useRef<number | null>(null);
  const animRafRef = useRef<number | null>(null);

  const runVerify = useCallback(async () => {
    setVerifyState("checking");
    const ok = await cryptoSelfTest();
    setVerifyState(ok ? "ok" : "fail");
  }, []);

  const verifyTap = useTap(() => {
    void gentleImpact();
    void runVerify();
  });

  useEffect(() => {
    if (open) {
      if (settings.encryptHistory) void runVerify();
      else setVerifyState("idle");
    }
  }, [open, settings.encryptHistory, runVerify]);
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [open]);

  useEffect(
    () => () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    },
    [],
  );

  function showNote(note: { label: string; detail?: string }) {
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    setExportNote(null);
    setImportNote(null);
    const isExport = note.label.startsWith("exported") || note.label.startsWith("nothing");
    const target = isExport ? setExportNote : setImportNote;
    target(note);
    noteTimerRef.current = setTimeout(() => target(null), 3800);
  }

  useEffect(() => {
    if (open) {
      animStartRef.current = null;
      setAnimTick(0);
      const animate = (now: number) => {
        if (animStartRef.current === null) animStartRef.current = now;
        const elapsed = now - animStartRef.current;
        setAnimTick(elapsed);
        if (elapsed < 1300) {
          animRafRef.current = requestAnimationFrame(animate);
        } else {
          setAnimTick(9999);
        }
      };
      animRafRef.current = requestAnimationFrame(animate);
    } else {
      if (animRafRef.current !== null) {
        cancelAnimationFrame(animRafRef.current);
        animRafRef.current = null;
      }
      animStartRef.current = null;
      setAnimTick(0);
    }
    return () => {
      if (animRafRef.current !== null) {
        cancelAnimationFrame(animRafRef.current);
        animRafRef.current = null;
      }
    };
  }, [open]);

  function openReleases() {
    window.open("https://github.com/zayan-builds/tempo-timer/releases/latest", "_blank");
  }

  function openPrivacy() {
    window.open("https://github.com/zayan-builds/tempo-timer/blob/main/PRIVACY_POLICY.md", "_blank");
  }

  async function handleExport() {
    if (solves.length === 0) {
      showNote({ label: "nothing to export yet — solve your first cube" });
      return;
    }
    const json = exportSolves(solves);
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `tempo-history-${date}.json`;
    const kb = (new Blob([json]).size / 1024).toFixed(1);
    setExporting(true);
    await downloadJson(json, fileName);
    setExporting(false);
    showNote({
      label: `exported — ${solves.length} ${solves.length === 1 ? "solve" : "solves"}`,
      detail: `${fileName} · ${kb} KB`,
    });
  }

  async function stageImport(text: string, name: string, size: number) {
    const { solves: parsed, errors } = parseImport(text);
    if (parsed.length === 0) {
      setImportStage(null);
      const msg = errors.length > 0 ? errors[0] : "no valid solves found";
      showNote({ label: msg });
      return;
    }
    setImportStage({ name, size, count: parsed.length, solves: parsed });
    if (errors.length > 0) {
      showNote({
        label: `${errors.length} ${errors.length === 1 ? "entry" : "entries"} skipped (invalid)`,
      });
    }
  }

  async function handleImportClick() {
    void gentleImpact();
    const { picked, cancelled } = await pickJsonFile();
    if (cancelled) return;
    if (picked) {
      await stageImport(picked.text, picked.name, picked.size);
      return;
    }
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileText(file);
      await stageImport(text, file.name, file.size);
    } catch (err) {
      showNote({
        label: "could not read file",
        detail: err instanceof Error ? err.message : undefined,
      });
    }
    e.target.value = "";
  }

  async function confirmImport() {
    if (!importStage) return;
    const parsed = importStage.solves;
    setImportStage(null);
    try {
      const { imported, skipped } = await bulkImport(parsed);
      const parts: string[] = [];
      if (imported > 0) parts.push(`${imported} ${imported === 1 ? "solve" : "solves"} imported`);
      if (skipped > 0) parts.push(`${skipped} skipped (already exist)`);
      showNote({ label: parts.join(" · ") || "nothing new to import" });
    } catch {
      showNote({ label: "import failed — try again" });
    }
  }

  function showAuthToast() {
    setAuthToast("authenticate to disable lock");
    setTimeout(() => setAuthToast(null), 1800);
  }

  async function enableLock() {
    const bio = await isBiometricAvailable();
    if (bio) {
      const ok = await registerBiometric();
      if (ok) {
        update("lockMethod", "biometric");
        update("lockHistory", true);
        return;
      }
    }
    setPinSetupOpen(true);
  }

  function doDisableLock() {
    clearAuth();
    update("lockMethod", "none");
    update("lockHistory", false);
  }

  async function requestDisableLock() {
    if (settings.lockMethod === "biometric") {
      const ok = await verifyBiometric();
      if (ok) doDisableLock();
      else showAuthToast();
      return;
    }
    if (settings.lockMethod === "pin") {
      setPinDisableOpen(true);
      return;
    }
    doDisableLock();
  }

  function previewStopSound(e: React.MouseEvent) {
    e.stopPropagation();
    unlockAudio();
    sounds.stop();
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{
          background: "rgba(0, 0, 0, 0.97)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          WebkitOverflowScrolling: "touch",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(24px)",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
        onClick={onClose}
      >
        <div
          className="max-w-sm mx-auto"
          style={{ paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}
          onClick={(e) => e.stopPropagation()}
        >
              <p
                className="font-mono"
                style={{ color: accentHex, fontSize: 11, letterSpacing: "0.3em", marginBottom: 24 }}
              >
                settings
              </p>

              <div style={{ borderTop: HAIRLINE }}>
                <div style={{ borderBottom: HAIRLINE }}>
                  <Row
                    label="PRO MODE"
                    withDivider={false}
                    animTick={animTick}
                    rowIndex={0}
                    accentHex={accentHex}
                    trailingLabel={
                      <button
                        aria-label="what is pro mode"
                        onClick={() => { void gentleImpact(); setProTip((v) => !v); }}
                        className="font-mono"
                        style={{
                          width: 44,
                          height: 44,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "#F5F0E8",
                          opacity: proTip ? 0.7 : 0.35,
                          fontSize: 14,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          touchAction: "manipulation",
                          padding: 0,
                          flexShrink: 0,
                          transition: "opacity 0.2s ease",
                        }}
                      >
                        ?
                      </button>
                    }
                  >
                    <Toggle on={settings.proMode} onChange={(v) => update("proMode", v)} accentHex={accentHex} />
                  </Row>
                  <div
                    style={{
                      overflow: "hidden",
                      maxHeight: proTip ? 400 : 0,
                      opacity: proTip ? 1 : 0,
                      transition: "max-height 300ms ease, opacity 200ms ease",
                    }}
                  >
                    <div style={{ paddingBottom: 18 }}>
                      <p
                        className="font-mono"
                        style={{
                          color: "#F5F0E8",
                          opacity: 0.6,
                          fontSize: 11,
                          lineHeight: 1.7,
                          letterSpacing: "0.04em",
                          margin: 0,
                        }}
                      >
                        Adds a scramble sequence before every solve, so each attempt starts from the same fair position.
                      </p>
                      <p
                        className="font-mono"
                        style={{
                          color: "#F5F0E8",
                          opacity: 0.45,
                          fontSize: 10,
                          lineHeight: 1.6,
                          letterSpacing: "0.04em",
                          marginTop: 12,
                          marginBottom: 0,
                        }}
                      >
                        Also tracks your rolling averages (ao5, ao12) to measure consistency, not just your fastest time.
                      </p>
                    </div>
                  </div>
                </div>

                <Row
                  label="HAPTICS + SOUND"
                  animTick={animTick}
                  rowIndex={1}
                  accentHex={accentHex}
                  trailingLabel={
                    <button
                      aria-label="preview sound"
                      onClick={previewStopSound}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <SpeakerIcon size={12} opacity={settings.haptics ? 0.55 : 0.25} />
                    </button>
                  }
                >
                  <Toggle on={settings.haptics} onChange={(v) => update("haptics", v)} accentHex={accentHex} />
                </Row>

                <Row label="HOLD" labelFontSize={11} animTick={animTick} rowIndex={2} accentHex={accentHex}>
                  <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                    {HOLD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { void gentleImpact(); update("holdMs", opt.value); }}
                        className="font-mono"
                        style={{
                          color: settings.holdMs === opt.value ? accentHex : "#F5F0E8",
                          opacity: settings.holdMs === opt.value ? 1 : 0.35,
                          fontSize: 12,
                          letterSpacing: "0.16em",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "14px 8px",
                          margin: "-14px -8px",
                          touchAction: "manipulation",
                          minHeight: 44,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Row>

                <div style={{ paddingTop: 18, paddingBottom: 18, borderBottom: HAIRLINE }}>
                  <span
                    className="font-mono"
                    style={{ fontSize: 13, letterSpacing: "0.16em", color: "#F5F0E8", opacity: 0.85 }}
                  >
                    {"ACCENT".split("").map((char, i) => {
                      const startAt = 280 + 3 * 80 + i * 15;
                      const resolveAt = startAt + 220;
                      if (animTick < startAt) return <span key={i} style={{ opacity: 0 }}>{char}</span>;
                      if (animTick >= resolveAt) return <span key={i}>{char}</span>;
                      const rand = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                      return <span key={i} style={{ opacity: 0.75, color: accentHex }}>{rand}</span>;
                    })}
                  </span>
                  <div
                    style={{
                      marginTop: 14,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      alignItems: "center",
                      paddingRight: 4,
                    }}
                  >
                    {ACCENT_ORDER.map((name) => (
                      <button
                        key={name}
                        onClick={() => { if (!settings.dailyAccent) { void gentleImpact(); update("accent", name); } }}
                        aria-label={name}
                        style={{
                          width: 30,
                          height: 30,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "transparent",
                          border: "none",
                          cursor: settings.dailyAccent ? "default" : "pointer",
                          padding: 0,
                          flexShrink: 0,
                          touchAction: "manipulation",
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: ACCENT_HEX[name],
                            opacity: settings.dailyAccent ? 0.15 : (settings.accent === name ? 1 : 0.4),
                            transform: settings.accent === name ? "scale(1.18)" : "scale(1)",
                            transition: "opacity 200ms ease, transform 200ms ease",
                            border: settings.accent === name ? "1px solid rgba(245,240,232,0.4)" : "none",
                            display: "block",
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "#F5F0E8", opacity: 0.5 }}>
                      change every day
                    </span>
                    <button
                      onClick={() => { void gentleImpact(); update("dailyAccent", !settings.dailyAccent); }}
                      className="font-mono"
                      style={{
                        color: settings.dailyAccent ? accentHex : "#F5F0E8",
                        opacity: settings.dailyAccent ? 1 : 0.4,
                        fontSize: 12,
                        letterSpacing: "0.3em",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {settings.dailyAccent ? "on" : "off"}
                    </button>
                  </div>
                  {settings.dailyAccent && (
                    <p className="font-mono" style={{ marginTop: 6, color: accentHex, opacity: 0.6, fontSize: 9, letterSpacing: "0.18em" }}>
                      today: {getDailyAccentName()}
                    </p>
                  )}
                </div>

                <div style={{ paddingBottom: 18, borderBottom: HAIRLINE }}>
                  <Row
                    label="ENCRYPT HISTORY"
                    animTick={animTick}
                    rowIndex={4}
                    accentHex={accentHex}
                  >
                    <Toggle on={settings.encryptHistory} onChange={(v) => update("encryptHistory", v)} accentHex={accentHex} />
                  </Row>
                  <div style={{ marginTop: -2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        color: "#F5F0E8",
                        opacity: 0.5,
                        lineHeight: 1.6,
                        minWidth: 0,
                      }}
                    >
                      {settings.encryptHistory
                        ? `encrypted at rest — ${stats.encrypted} of ${stats.total} solves`
                        : "plaintext on this device"}
                    </span>
                    {settings.encryptHistory && (
                      <button
                        aria-label="verify encryption"
                        className="font-mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.18em",
                          color:
                            verifyState === "fail" ? "#E06C5C" : verifyState === "ok" ? accentHex : "#F5F0E8",
                          opacity: verifyState === "ok" ? 0.9 : 0.6,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "10px 4px",
                          margin: "-10px -4px",
                          touchAction: "manipulation",
                          flexShrink: 0,
                        }}
                        {...verifyTap}
                      >
                        {verifyState === "checking"
                          ? "checking…"
                          : verifyState === "ok"
                            ? "key verified"
                            : verifyState === "fail"
                              ? "verify failed"
                              : "verify"}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ paddingTop: 20, paddingBottom: 20 }}>
                  <div className="flex items-center justify-between">
                    <span
                      className="font-mono"
                      style={{ fontSize: 13, letterSpacing: "0.16em", color: "#F5F0E8", opacity: 0.85 }}
                    >
                      {"LOCK HISTORY".split("").map((char, i) => {
                        const startAt = 280 + 5 * 80 + i * 15;
                        const resolveAt = startAt + 220;
                        if (animTick < startAt) return <span key={i} style={{ opacity: 0 }}>{char}</span>;
                        if (animTick >= resolveAt) return <span key={i}>{char}</span>;
                        const rand = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                        return <span key={i} style={{ opacity: 0.75, color: accentHex }}>{rand}</span>;
                      })}
                    </span>
                    <Toggle
                      on={settings.lockHistory}
                      onChange={(v) => (v ? enableLock() : requestDisableLock())}
                      accentHex={accentHex}
                    />
                  </div>
                  {settings.lockHistory && settings.lockMethod !== "none" && (
                    <p
                      className="font-mono"
                      style={{
                        marginTop: 6,
                        color: accentHex,
                        opacity: 0.7,
                        fontSize: 9,
                        letterSpacing: "0.2em",
                      }}
                    >
                      secured with biometrics
                    </p>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 48, borderTop: HAIRLINE, paddingTop: 28 }}>
                <p className="font-mono" style={{ color: accentHex, fontSize: 11, letterSpacing: "0.3em", marginBottom: 14 }}>
                  data
                </p>
                <Row label="EXPORT HISTORY" rowIndex={6} animTick={animTick} accentHex={accentHex}>
                  <PillButton
                    label={exporting ? "…" : "export"}
                    variant="filled"
                    accentHex={accentHex}
                    dimmed={solves.length === 0}
                    onClick={() => { void handleExport(); }}
                  />
                </Row>
                <div style={{ marginTop: -2, marginBottom: 2 }}>
                  <NotePanel note={exportNote} accentHex={accentHex} />
                </div>
                <Row label="IMPORT HISTORY" rowIndex={7} animTick={animTick} accentHex={accentHex}>
                  <PillButton label="import" variant="ghost" accentHex={accentHex} onClick={handleImportClick} />
                </Row>
                {importStage && (
                  <div
                    className="font-mono"
                    style={{
                      marginBottom: 8,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(245,240,232,0.03)",
                      border: HAIRLINE,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          color: accentHex,
                          fontSize: 9.5,
                          letterSpacing: "0.16em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        restore backup?
                      </span>
                      <span
                        style={{
                          color: "#F5F0E8",
                          opacity: 0.5,
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {importStage.name} · {importStage.size > 0 ? `${(importStage.size / 1024).toFixed(1)} KB · ` : ""}
                        {importStage.count} {importStage.count === 1 ? "solve" : "solves"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <PillButton
                        label="import"
                        variant="filled"
                        accentHex={accentHex}
                        onClick={() => { void confirmImport(); }}
                      />
                      <PillButton
                        label="cancel"
                        variant="ghost"
                        accentHex={accentHex}
                        onClick={() => setImportStage(null)}
                      />
                    </div>
                  </div>
                )}
                <div style={{ marginTop: importStage ? -2 : 0, marginBottom: 2 }}>
                  <NotePanel note={importNote} accentHex={accentHex} />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={handleFileSelected}
                />
              </div>

              <p
                className="font-mono"
                style={{
                  color: "#F5F0E8",
                  opacity: 0.5,
                  fontSize: 11,
                  lineHeight: 1.6,
                  letterSpacing: "0.04em",
                  marginTop: 14,
                }}
              >
                Your history stays on this device. Encryption protects it at rest; lock requires biometrics to view.
              </p>

              <div style={{ marginTop: 48, borderTop: HAIRLINE, paddingTop: 28 }}>
                <p
                  className="font-mono"
                  style={{ color: accentHex, fontSize: 11, letterSpacing: "0.3em", marginBottom: 14 }}
                >
                  about tempo
                </p>
                <p
                  className="font-mono"
                  style={{
                    color: "#F5F0E8",
                    opacity: 0.7,
                    fontSize: 12,
                    letterSpacing: "0.04em",
                    fontStyle: "italic",
                    marginBottom: 14,
                  }}
                >
                  open source · MIT · built by zayan
                </p>
                <a
                  href="https://github.com/zayan-builds/tempo-timer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono"
                  style={{
                    color: accentHex,
                    fontSize: 12,
                    letterSpacing: "0.04em",
                    textDecoration: "none",
                    display: "inline-block",
                    marginBottom: 18,
                  }}
                >
                  github.com/zayan-builds/tempo-timer
                </a>
                <p
                  className="font-mono"
                  style={{
                    color: "#F5F0E8",
                    opacity: 0.3,
                    fontSize: 10,
                    letterSpacing: "0.18em",
                  }}
                >
                  v{process.env.NEXT_PUBLIC_APP_VERSION || "0.1.22"}
                </p>
              </div>

              <div style={{ marginTop: 48 }}>
                <button
                  onClick={openReleases}
                  className="font-mono"
                  style={{
                    color: "#F5F0E8",
                    opacity: 0.3,
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    touchAction: "manipulation",
                  }}
                >
                  check for updates
                </button>

                <button
                  onClick={openPrivacy}
                  className="font-mono"
                  style={{
                    color: "#F5F0E8",
                    opacity: 0.3,
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    marginLeft: 16,
                    touchAction: "manipulation",
                  }}
                >
                  privacy policy
                </button>
              </div>

              <button
                onClick={onClose}
                className="font-mono"
                style={{
                  marginTop: 24,
                  color: accentHex,
                  fontSize: 11,
                  letterSpacing: "0.3em",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                done
              </button>
            </div>
      </div>

      {pinSetupOpen && (
        <PinPad
          mode="set"
          accentHex={accentHex}
          title="set biometric code"
          onCancel={() => setPinSetupOpen(false)}
          onSubmit={async (pin) => {
            await setPin(pin);
            update("lockMethod", "pin");
            update("lockHistory", true);
            setPinSetupOpen(false);
            return true;
          }}
        />
      )}

      {pinDisableOpen && (
        <PinPad
          mode="verify"
          accentHex={accentHex}
          title="enter biometric code"
          onCancel={() => {
            setPinDisableOpen(false);
            showAuthToast();
          }}
          onSubmit={async (pin) => {
            const { verifyPin } = await import("@/lib/auth");
            const ok = await verifyPin(pin);
            if (ok) {
              setPinDisableOpen(false);
              doDisableLock();
              return true;
            }
            return false;
          }}
        />
      )}

      <div
        className="fixed left-0 right-0 flex justify-center font-mono"
        style={{
          bottom: 60,
          zIndex: 70,
          color: accentHex,
          fontSize: 10,
          letterSpacing: "0.3em",
          pointerEvents: "none",
          opacity: authToast ? 1 : 0,
          transform: authToast ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
          textAlign: "center",
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        {authToast}
      </div>
    </>
  );
}
