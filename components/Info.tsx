"use client";
import { useEffect, useRef } from "react";

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.3em",
  marginTop: 32,
  marginBottom: 18,
};

export function Info({
  open,
  onClose,
  accentHex,
}: {
  open: boolean;
  onClose: () => void;
  accentHex: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    const raf = requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; });
    const timer = setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, 280);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [open]);

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        background: "rgba(0, 0, 0, 0.97)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        WebkitOverflowScrolling: "touch",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.25s ease",
      }}
      onClick={onClose}
    >
          <div
            className="max-w-sm mx-auto px-8 font-mono"
            style={{
              paddingTop: 64,
              paddingBottom: 64,
              color: "#F5F0E8",
              fontSize: 13,
              lineHeight: 1.7,
              letterSpacing: "0.03em",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ ...SECTION_LABEL_STYLE, marginTop: 0, color: accentHex }}>
              how to use tempo
            </p>
            <p style={{ marginBottom: 16, opacity: 0.85 }}>
              Hold anywhere on the screen. The timer will brighten after a moment. That means it&apos;s ready. Let go to start.
            </p>
            <p style={{ marginBottom: 16, opacity: 0.85 }}>
              Tap anywhere to stop. Your time is saved automatically.
            </p>
            <p style={{ marginBottom: 8, opacity: 0.85 }}>
              If you beat your fastest time, you&apos;ll see <span style={{ color: accentHex }}>new best</span> appear. That&apos;s the only thing that matters at first.
            </p>

            <p style={{ ...SECTION_LABEL_STYLE, color: accentHex }}>settings explained</p>
            <p style={{ marginBottom: 14, opacity: 0.85 }}>
              <span style={{ color: accentHex }}>Pro Mode</span> — turns on scramble notation at the top (instructions for how to mix up your cube before each solve) and shows your rolling averages. For serious cubers only.
            </p>
            <p style={{ marginBottom: 14, opacity: 0.85 }}>
              <span style={{ color: accentHex }}>Haptics</span> — subtle vibration feedback when you start and stop. Recommended on.
            </p>
            <p style={{ marginBottom: 14, opacity: 0.85 }}>
              <span style={{ color: accentHex }}>Hold Duration</span> — how long to hold before the timer arms. Start with 0.5s. Go shorter as you get faster.
            </p>
            <p style={{ marginBottom: 14, opacity: 0.85 }}>
              <span style={{ color: accentHex }}>Accent</span> — changes the glow color throughout the app.
            </p>
            <p style={{ marginBottom: 14, opacity: 0.85 }}>
              <span style={{ color: accentHex }}>Encrypt History</span> — your solves are stored only on this device. Turning this on adds automatic encryption so nobody else can read your history even if they access your device. No password needed, it handles itself.
            </p>
            <p style={{ marginBottom: 8, opacity: 0.85 }}>
              <span style={{ color: accentHex }}>Lock History</span> — requires biometrics before anyone can view your solve history.
            </p>

            <button
              onClick={onClose}
              className="font-mono"
              style={{
                marginTop: 40,
                color: accentHex,
                fontSize: 11,
                letterSpacing: "0.3em",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              close
            </button>
          </div>
    </div>
  );
}
