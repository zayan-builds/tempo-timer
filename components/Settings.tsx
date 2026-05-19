"use client";
import { useState, useEffect, useRef } from "react";
import { ACCENT_HEX, AccentName, useSettings } from "@/lib/settings";
import {
  clearAuth,
  isBiometricAvailable,
  registerBiometric,
  setPin,
  verifyBiometric,
} from "@/lib/auth";
import { sounds, unlockAudio } from "@/lib/sound";
import { PinPad } from "./PinPad";

const ACCENT_ORDER: AccentName[] = [
  "amber", "blue", "green", "red", "purple", "white",
];
const HOLD_OPTIONS: Array<{ value: 300 | 500 | 750; label: string }> = [
  { value: 300, label: "0.3s" },
  { value: 500, label: "0.5s" },
  { value: 750, label: "0.75s" },
];

const HAIRLINE = "1px solid rgba(245,240,232,0.08)";
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%!?[]{}\\^~<>*&=+";

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
  return (
    <button
      onClick={() => onChange(!on)}
      className="font-mono"
      style={{
        color: on ? accentHex : "#F5F0E8",
        opacity: on ? 1 : 0.4,
        fontSize: 12,
        letterSpacing: "0.3em",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {on ? "on" : "off"}
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

export function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update, accentHex } = useSettings();
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [pinDisableOpen, setPinDisableOpen] = useState(false);
  const [authToast, setAuthToast] = useState<string | null>(null);
  const [proTip, setProTip] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [animTick, setAnimTick] = useState(0);
  const animStartRef = useRef<number | null>(null);
  const animRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [open]);

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
                        onClick={() => setProTip((v) => !v)}
                        style={{
                          width: 44,
                          height: 44,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          touchAction: "manipulation",
                          padding: 0,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          className="font-mono"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            border: `1px solid rgba(245,240,232,0.4)`,
                            color: accentHex,
                            fontSize: 10,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >
                          ?
                        </span>
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
                    <p
                      className="font-mono"
                      style={{
                        color: "#F5F0E8",
                        opacity: 0.55,
                        fontSize: 11,
                        lineHeight: 1.7,
                        letterSpacing: "0.04em",
                        paddingBottom: 18,
                      }}
                    >
                      Pro Mode shows a scramble before each solve. A scramble is a sequence of moves that randomizes your cube so every solve starts from a fair position. It also tracks ao5 and ao12, your rolling average across your last 5 and 12 solves, showing consistent speed rather than just your best.
                    </p>
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
                        onClick={() => update("holdMs", opt.value)}
                        className="font-mono"
                        style={{
                          color: settings.holdMs === opt.value ? accentHex : "#F5F0E8",
                          opacity: settings.holdMs === opt.value ? 1 : 0.35,
                          fontSize: 12,
                          letterSpacing: "0.16em",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
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
                        onClick={() => update("accent", name)}
                        aria-label={name}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: ACCENT_HEX[name],
                          opacity: settings.accent === name ? 1 : 0.4,
                          transform: settings.accent === name ? "scale(1.18)" : "scale(1)",
                          transition: "opacity 200ms ease, transform 200ms ease",
                          border: settings.accent === name ? "1px solid rgba(245,240,232,0.4)" : "none",
                          cursor: "pointer",
                          padding: 0,
                          flexShrink: 0,
                          touchAction: "manipulation",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <Row label="ENCRYPT HISTORY" animTick={animTick} rowIndex={4} accentHex={accentHex}>
                  <Toggle
                    on={settings.encryptHistory}
                    onChange={(v) => update("encryptHistory", v)}
                    accentHex={accentHex}
                  />
                </Row>

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
                  v0.1.12
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
        }}
      >
        {authToast}
      </div>
    </>
  );
}
