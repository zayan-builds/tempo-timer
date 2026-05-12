"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
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
  "amber", "blue", "green", "red", "white",
  "purple", "rose", "gold", "teal", "orange",
];
const HOLD_OPTIONS: Array<{ value: 300 | 500 | 750; label: string }> = [
  { value: 300, label: "0.3s" },
  { value: 500, label: "0.5s" },
  { value: 750, label: "0.75s" },
];

const HAIRLINE = "1px solid rgba(245,240,232,0.08)";

function Row({
  label,
  children,
  withDivider = true,
  trailingLabel,
}: {
  label: string;
  children: React.ReactNode;
  withDivider?: boolean;
  trailingLabel?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        paddingTop: 20,
        paddingBottom: 20,
        borderBottom: withDivider ? HAIRLINE : "none",
      }}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <span className="font-mono" style={{ fontSize: 13, letterSpacing: "0.16em", color: "#F5F0E8", opacity: 0.85 }}>
          {label}
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
  const [proExplainerOpen, setProExplainerOpen] = useState(false);

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
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{
              background: "rgba(0, 0, 0, 0.97)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              WebkitOverflowScrolling: "touch",
            }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
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
                    trailingLabel={
                      <button
                        aria-label="what is pro mode"
                        onClick={() => setProExplainerOpen((v) => !v)}
                        className="font-mono"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "transparent",
                          border: "1px solid rgba(245,240,232,0.25)",
                          color: "#F5F0E8",
                          opacity: 0.55,
                          fontSize: 10,
                          lineHeight: "16px",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        ?
                      </button>
                    }
                  >
                    <Toggle on={settings.proMode} onChange={(v) => update("proMode", v)} accentHex={accentHex} />
                  </Row>
                  <AnimatePresence initial={false}>
                    {proExplainerOpen && (
                      <motion.div
                        key="pro-explainer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
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
                          Pro Mode shows a scramble at the top before each solve. A scramble is a sequence of moves that randomizes your cube so every solve starts from a fair position.
                          {"\n\n"}
                          It also tracks ao5 and ao12: your rolling average across your last 5 and 12 solves. These show your consistent speed, not just your best time.
                          {"\n\n"}
                          Recommended once you can solve reliably under 2 minutes.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Row
                  label="HAPTICS + SOUND"
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

                <Row label="HOLD DURATION">
                  <div className="flex gap-4">
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

                <div style={{ paddingTop: 20, paddingBottom: 20, borderBottom: HAIRLINE }}>
                  <span
                    className="font-mono"
                    style={{ fontSize: 13, letterSpacing: "0.16em", color: "#F5F0E8", opacity: 0.85 }}
                  >
                    ACCENT
                  </span>
                  <div
                    style={{
                      marginTop: 16,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      alignItems: "center",
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
                        }}
                      />
                    ))}
                  </div>
                </div>

                <Row label="ENCRYPT HISTORY">
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
                      LOCK HISTORY
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
                      secured with {settings.lockMethod === "biometric" ? "fingerprint" : "PIN"}
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
                Your history stays on this device. Encryption protects it at rest; lock requires your fingerprint or PIN to view.
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
                  v0.1.3
                </p>
              </div>

              <button
                onClick={onClose}
                className="font-mono"
                style={{
                  marginTop: 48,
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
          </motion.div>
        )}
      </AnimatePresence>

      {pinSetupOpen && (
        <PinPad
          mode="set"
          accentHex={accentHex}
          title="set a 4-digit pin"
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
          title="enter pin to disable lock"
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

      <AnimatePresence>
        {authToast && (
          <motion.div
            className="fixed left-0 right-0 flex justify-center font-mono"
            style={{
              bottom: 60,
              zIndex: 70,
              color: accentHex,
              fontSize: 10,
              letterSpacing: "0.3em",
              pointerEvents: "none",
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
          >
            {authToast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
