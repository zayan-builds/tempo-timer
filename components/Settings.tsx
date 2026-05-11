"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ACCENT_HEX, AccentName, useSettings } from "@/lib/settings";
import {
  clearAuth,
  isBiometricAvailable,
  registerBiometric,
  setPin,
} from "@/lib/auth";
import { PinPad } from "./PinPad";

const ACCENT_ORDER: AccentName[] = ["amber", "blue", "green", "red", "white"];
const HOLD_OPTIONS: Array<{ value: 300 | 500 | 750; label: string }> = [
  { value: 300, label: "0.3s" },
  { value: 500, label: "0.5s" },
  { value: 750, label: "0.75s" },
];

const HAIRLINE = "1px solid rgba(245,240,232,0.08)";

function Row({ label, children, withDivider = true }: { label: string; children: React.ReactNode; withDivider?: boolean }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        paddingTop: 20,
        paddingBottom: 20,
        borderBottom: withDivider ? HAIRLINE : "none",
      }}
    >
      <span className="font-mono" style={{ fontSize: 13, letterSpacing: "0.16em", color: "#F5F0E8", opacity: 0.85 }}>
        {label}
      </span>
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

export function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update, accentHex } = useSettings();
  const [pinSetupOpen, setPinSetupOpen] = useState(false);

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

  function disableLock() {
    clearAuth();
    update("lockMethod", "none");
    update("lockHistory", false);
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
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          >
            <div
              className="max-w-sm mx-auto px-8"
              style={{ paddingTop: 80, paddingBottom: 80 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p
                className="font-mono"
                style={{ color: accentHex, fontSize: 11, letterSpacing: "0.3em", marginBottom: 24 }}
              >
                settings
              </p>

              <div style={{ borderTop: HAIRLINE }}>
                <Row label="PRO MODE">
                  <Toggle on={settings.proMode} onChange={(v) => update("proMode", v)} accentHex={accentHex} />
                </Row>

                <Row label="HAPTICS">
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

                <Row label="ACCENT">
                  <div className="flex gap-4 items-center">
                    {ACCENT_ORDER.map((name) => (
                      <button
                        key={name}
                        onClick={() => update("accent", name)}
                        aria-label={name}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: ACCENT_HEX[name],
                          opacity: settings.accent === name ? 1 : 0.35,
                          transform: settings.accent === name ? "scale(1.2)" : "scale(1)",
                          transition: "all 200ms ease",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </Row>

                <Row label="ENCRYPT HISTORY">
                  <Toggle
                    on={settings.encryptHistory}
                    onChange={(v) => update("encryptHistory", v)}
                    accentHex={accentHex}
                  />
                </Row>

                <Row label="LOCK HISTORY" withDivider={false}>
                  <Toggle
                    on={settings.lockHistory}
                    onChange={(v) => (v ? enableLock() : disableLock())}
                    accentHex={accentHex}
                  />
                </Row>
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

              <p
                className="font-mono"
                style={{
                  color: "#F5F0E8",
                  opacity: 0.4,
                  fontSize: 10,
                  lineHeight: 1.6,
                  letterSpacing: "0.04em",
                  marginTop: 12,
                  fontStyle: "italic",
                }}
              >
                Sound feedback follows the Haptics setting.
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
                  v0.1.0
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
    </>
  );
}
