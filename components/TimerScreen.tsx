"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bloom } from "./Bloom";
import { TimerDisplay } from "./TimerDisplay";
import { Info } from "./Info";
import { Settings } from "./Settings";
import dynamic from "next/dynamic";

const History = dynamic(() => import("./History").then((m) => ({ default: m.History })), {
  ssr: false,
});
const PinPad = dynamic(() => import("./PinPad").then((m) => ({ default: m.PinPad })), {
  ssr: false,
});
import { generateScramble } from "@/lib/scramble";
import { formatTime } from "@/lib/format";
import { avgOfN, useHistory } from "@/hooks/useHistory";
import { useSettings } from "@/lib/settings";
import { sounds, unlockAudio } from "@/lib/sound";
import { verifyBiometric, verifyPin } from "@/lib/auth";
import { getComparison } from "@/lib/comparison";
import { triggerHaptic } from "@/lib/haptics";
import { App as CapApp } from "@capacitor/app";

type State = "idle" | "armed" | "running" | "stopped" | "pb";

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function TimerScreen() {
  const { settings, accentHex } = useSettings();
  const { solves, addSolve, deleteSolve, clearAll } = useHistory();

  const [state, setState] = useState<State>("idle");
  const [scramble, setScramble] = useState<string>("");
  const [displayMs, setDisplayMs] = useState<number>(0);
  const [lastSolveMs, setLastSolveMs] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pinVerifyOpen, setPinVerifyOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [comparisonFull, setComparisonFull] = useState<string | null>(null);
  const [typedText, setTypedText] = useState("");
  const [chevronFlash, setChevronFlash] = useState(false);
  const [pinFailCount, setPinFailCount] = useState(0);

  const startedAtRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<State>("idle");
  const scrambleRef = useRef<string>("");
  const overlayOpenRef = useRef(false);
  const pressStartYRef = useRef<number | null>(null);
  const pressStartXRef = useRef<number | null>(null);
  const swipeTriggeredRef = useRef(false);
  const newSessionPlayedRef = useRef(false);
  const comparisonShowRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comparisonHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typewriterTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearComparisonTimers = useCallback(() => {
    if (comparisonShowRef.current) {
      clearTimeout(comparisonShowRef.current);
      comparisonShowRef.current = null;
    }
    if (comparisonHideRef.current) {
      clearTimeout(comparisonHideRef.current);
      comparisonHideRef.current = null;
    }
    typewriterTimersRef.current.forEach(clearTimeout);
    typewriterTimersRef.current = [];
  }, []);

  const scheduleComparison = useCallback(
    (elapsedMs: number, isPB: boolean) => {
      clearComparisonTimers();
      setComparisonFull(null);
      setTypedText("");
      const showDelay = isPB ? 800 : 500;
      comparisonShowRef.current = setTimeout(() => {
        const text = getComparison(elapsedMs / 1000);
        setComparisonFull(text);
        setTypedText("");
        for (let i = 1; i <= text.length; i++) {
          const t = setTimeout(() => setTypedText(text.slice(0, i)), i * 28);
          typewriterTimersRef.current.push(t);
        }
        const total = text.length * 28 + 2500;
        comparisonHideRef.current = setTimeout(() => {
          setComparisonFull(null);
          setTypedText("");
        }, total);
      }, showDelay);
    },
    [clearComparisonTimers],
  );

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { scrambleRef.current = scramble; }, [scramble]);
  useEffect(() => {
    overlayOpenRef.current = infoOpen || settingsOpen || historyOpen || pinVerifyOpen;
  }, [infoOpen, settingsOpen, historyOpen, pinVerifyOpen]);

  useEffect(() => {
    if (settings.proMode && !scramble) setScramble(generateScramble());
  }, [settings.proMode, scramble]);

  const hasSolveToday = useMemo(() => {
    const today = startOfDay(Date.now());
    return solves.some((s) => s.timestamp >= today);
  }, [solves]);

  const feedback = useCallback(
    (kind: "armed" | "start" | "stop" | "pb") => {
      if (!settings.haptics) return;
      void triggerHaptic(kind);
      sounds[kind]();
    },
    [settings.haptics],
  );

  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const tick = useCallback(() => {
    setDisplayMs(performance.now() - startedAtRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const beginRunning = useCallback(() => {
    if (!hasSolveToday && solves.length > 0 && settings.haptics && !newSessionPlayedRef.current) {
      sounds.newSession();
      newSessionPlayedRef.current = true;
    }
    startedAtRef.current = performance.now();
    setDisplayMs(0);
    setState("running");
    feedback("start");
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, feedback, hasSolveToday, solves.length, settings.haptics]);

  const stopRunning = useCallback(() => {
    stopRaf();
    const elapsed = performance.now() - startedAtRef.current;
    setDisplayMs(elapsed);
    const result = addSolve(elapsed, scrambleRef.current);
    setLastSolveMs(elapsed);
    if (result.isPB) {
      setState("pb");
      feedback("pb");
    } else {
      setState("stopped");
      feedback("stop");
    }
    scheduleComparison(elapsed, result.isPB);
    if (settings.proMode) setScramble(generateScramble());
  }, [addSolve, settings.proMode, feedback, scheduleComparison]);

  const armHold = useCallback(() => {
    if (stateRef.current === "running" || stateRef.current === "armed") return;
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    holdTimeoutRef.current = setTimeout(() => {
      setState("armed");
      setDisplayMs(0);
      clearComparisonTimers();
      setComparisonFull(null);
      setTypedText("");
      feedback("armed");
    }, settings.holdMs);
  }, [settings.holdMs, feedback, clearComparisonTimers]);

  const cancelHold = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  }, []);

  const openHistoryGated = useCallback(async () => {
    if (!settings.lockHistory) {
      setHistoryOpen(true);
      return;
    }
    setChevronFlash(true);
    setTimeout(() => setChevronFlash(false), 200);
    if (settings.lockMethod === "biometric") {
      const ok = await verifyBiometric();
      if (ok) setHistoryOpen(true);
      return;
    }
    if (settings.lockMethod === "pin") {
      setPinFailCount(0);
      setPinVerifyOpen(true);
      return;
    }
    setHistoryOpen(true);
  }, [settings.lockHistory, settings.lockMethod]);

  const onPress = useCallback(
    (e: React.PointerEvent) => {
      if (overlayOpenRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      unlockAudio();
      pressStartYRef.current = e.clientY;
      pressStartXRef.current = e.clientX;
      swipeTriggeredRef.current = false;
      if (stateRef.current === "running") {
        stopRunning();
        return;
      }
      armHold();
    },
    [armHold, stopRunning],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (overlayOpenRef.current) return;
      const startY = pressStartYRef.current;
      const startX = pressStartXRef.current;
      if (startY === null || startX === null || swipeTriggeredRef.current) return;
      if (stateRef.current === "running" || stateRef.current === "armed") return;
      const screenH = typeof window !== "undefined" ? window.innerHeight : 0;
      if (startY < screenH * 0.7) return;
      const dy = startY - e.clientY;
      const dx = Math.abs(e.clientX - startX);
      if (dy > 60 && dx < 30) {
        swipeTriggeredRef.current = true;
        cancelHold();
        pressStartYRef.current = null;
        pressStartXRef.current = null;
        void openHistoryGated();
      }
    },
    [cancelHold, openHistoryGated],
  );

  const onRelease = useCallback(
    (e: React.PointerEvent) => {
      if (overlayOpenRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      pressStartYRef.current = null;
      pressStartXRef.current = null;
      cancelHold();
      if (swipeTriggeredRef.current) {
        swipeTriggeredRef.current = false;
        return;
      }
      if (stateRef.current === "armed") beginRunning();
    },
    [cancelHold, beginRunning],
  );

  useEffect(
    () => () => {
      stopRaf();
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      clearComparisonTimers();
    },
    [clearComparisonTimers],
  );

  useEffect(() => {
    const handleBack = () => {
      if (historyOpen) { setHistoryOpen(false); return; }
      if (settingsOpen) { setSettingsOpen(false); return; }
      if (infoOpen) { setInfoOpen(false); return; }
      if (pinVerifyOpen) { setPinVerifyOpen(false); return; }
      void CapApp.minimizeApp().catch(() => {});
    };
    const onPopState = (e: PopStateEvent) => {
      e.preventDefault?.();
      handleBack();
      window.history.pushState(null, "", window.location.href);
    };
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", onPopState);
    }
    let remove: (() => void) | null = null;
    CapApp.addListener("backButton", handleBack)
      .then((h) => { remove = () => h.remove(); })
      .catch(() => {});
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("popstate", onPopState);
      if (remove) remove();
    };
  }, [historyOpen, settingsOpen, infoOpen, pinVerifyOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (overlayOpenRef.current) return;
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      if (stateRef.current === "running") {
        stopRunning();
        return;
      }
      armHold();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (overlayOpenRef.current) return;
      if (e.code !== "Space") return;
      e.preventDefault();
      cancelHold();
      if (stateRef.current === "armed") beginRunning();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [armHold, beginRunning, cancelHold, stopRunning]);

  const ao5 = avgOfN(solves, 5);
  const ao12 = avgOfN(solves, 12);

  const statsVisible = settings.proMode && state !== "running";
  const scrambleVisible = settings.proMode && !!scramble;
  const scrambleOpacity = state === "running" ? 0.18 : 0.6;
  const pbFlash = state === "pb";
  const chevronVisible = state !== "running" && state !== "armed";
  const comparisonShown = !!comparisonFull && state !== "running" && state !== "armed";

  return (
    <>
      <main
        className="tempo-mount-in relative w-full bg-black overflow-hidden touch-none select-none"
        style={{
          WebkitUserSelect: "none",
          height: "100dvh",
          minHeight: "100dvh",
          transform: `translate3d(0, ${historyOpen ? "-30%" : "0"}, 0)`,
          transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "transform",
        }}
      >
        <Bloom state={state} accentHex={accentHex} />

        <AnimatePresence>
          {pbFlash && (
            <motion.div
              key="pb-flash"
              aria-hidden
              className="fixed inset-0 pointer-events-none"
              style={{ background: accentHex, zIndex: 2 }}
              initial={{ opacity: 0.2 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        <button
          aria-label="info"
          onClick={() => setInfoOpen(true)}
          className="absolute font-mono"
          style={{
            top: 18, left: 20, zIndex: 30,
            color: "#F5F0E8", opacity: 0.55, fontSize: 14,
            background: "transparent", border: "none", cursor: "pointer",
            width: 32, height: 32, padding: 0,
          }}
        >
          ?
        </button>

        <button
          aria-label="settings"
          onClick={() => setSettingsOpen(true)}
          className="absolute"
          style={{
            top: 18, right: 20, zIndex: 30,
            opacity: 0.55, background: "transparent", border: "none", cursor: "pointer",
            width: 32, height: 32, padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5F0E8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {scrambleVisible && (
          <div
            className="absolute left-0 right-0 flex justify-center px-12"
            style={{
              top: 56,
              zIndex: 5,
              opacity: scrambleOpacity,
              transition: "opacity 0.4s ease",
            }}
          >
            <span
              className="font-mono text-center"
              style={{ color: accentHex, fontSize: 12, letterSpacing: "0.08em" }}
            >
              {scramble}
            </span>
          </div>
        )}

        {/* Timer + new-best slot (fixed, no layout shift) */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: "45%",
            transform: "translateY(-50%)",
            zIndex: 5,
            paddingLeft: 24,
            paddingRight: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <TimerDisplay ms={displayMs} state={state} accentHex={accentHex} />
            {/* new-best label: absolute, never affects layout */}
            <div
              aria-hidden={state !== "pb"}
              style={{
                position: "absolute",
                left: "50%",
                top: "100%",
                transform: "translateX(-50%)",
                marginTop: 18,
                color: accentHex,
                fontSize: 10,
                letterSpacing: "0.3em",
                opacity: state === "pb" ? 1 : 0,
                transition: "opacity 600ms cubic-bezier(0.4,0,0.2,1)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
              className="font-mono"
            >
              new best
            </div>
          </div>

          {/* Comparison slot: pre-reserved min-height, absolute overlay so no jump */}
          <div
            style={{
              position: "relative",
              width: "100%",
              marginTop: state === "pb" ? 44 : 32,
              minHeight: 36,
              transition: "margin-top 0.3s ease",
            }}
          >
            <div
              className="font-mono italic text-center"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                color: accentHex,
                fontSize: 12,
                letterSpacing: "0.05em",
                paddingLeft: 16,
                paddingRight: 16,
                opacity: comparisonShown ? 1 : 0,
                transition: comparisonShown
                  ? "opacity 0.25s ease-out"
                  : "opacity 0.6s ease-in",
                pointerEvents: "none",
              }}
            >
              {typedText}
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div
          className="absolute left-0 right-0 px-8 flex justify-center items-center font-mono"
          style={{
            bottom: "5%",
            color: "#F5F0E8",
            fontSize: 11,
            letterSpacing: "0.08em",
            zIndex: 5,
            minHeight: 16,
          }}
        >
          <AnimatePresence mode="wait">
            {statsVisible && lastSolveMs !== null && (
              <motion.div
                key="bottom-row"
                layout={false}
                className="w-full flex justify-between items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.55 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span style={{ minWidth: 80 }}>{ao5 !== null ? `ao5  ${formatTime(ao5)}` : ""}</span>
                <span>{formatTime(lastSolveMs)}</span>
                <span style={{ minWidth: 80, textAlign: "right" }}>{ao12 !== null ? `ao12 ${formatTime(ao12)}` : ""}</span>
              </motion.div>
            )}
            {!statsVisible && lastSolveMs !== null && state !== "running" && (
              <motion.div
                key="bottom-last"
                layout={false}
                className="flex flex-col items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span style={{ color: "#F5F0E8", opacity: 0.3, fontSize: 10, letterSpacing: "0.3em", marginBottom: 6 }}>
                  last solve
                </span>
                <span style={{ color: "#F5F0E8", opacity: 0.7, fontSize: 13, letterSpacing: "0.08em" }}>
                  {formatTime(lastSolveMs)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chevron — opens history */}
        <AnimatePresence>
          {chevronVisible && (
            <motion.button
              key="history-chevron"
              layout={false}
              aria-label="history"
              onClick={() => void openHistoryGated()}
              className={`absolute${chevronFlash ? "" : " tempo-chevron-pulse"}`}
              style={{
                left: "50%",
                bottom: 14,
                transform: "translateX(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 8,
                zIndex: 25,
              }}
              initial={{ opacity: 0 }}
              animate={chevronFlash ? { opacity: 1 } : { opacity: undefined }}
              exit={{ opacity: 0 }}
              transition={{ duration: chevronFlash ? 0.18 : 0.4 }}
            >
              <svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke={chevronFlash ? accentHex : "#F5F0E8"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 10 11 4 19 10" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Auth error toast */}
        <AnimatePresence>
          {authError && (
            <motion.div
              key="auth-error"
              layout={false}
              className="absolute left-0 right-0 flex justify-center font-mono"
              style={{ bottom: 80, zIndex: 30, color: accentHex, fontSize: 10, letterSpacing: "0.3em" }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
            >
              {authError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Touch zone */}
        <div
          className="absolute left-0 right-0 bottom-0"
          style={{ height: "65%", zIndex: 10 }}
          onPointerDown={onPress}
          onPointerMove={onPointerMove}
          onPointerUp={onRelease}
          onPointerCancel={onRelease}
          onPointerLeave={(e) => {
            if (stateRef.current === "armed" || holdTimeoutRef.current) onRelease(e);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />

        <Info open={infoOpen} onClose={() => setInfoOpen(false)} accentHex={accentHex} />
        <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </main>

      {/* History — stacked positional panel, always mounted, slides over */}
      <History
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        solves={solves}
        onDelete={deleteSolve}
        onClearAll={clearAll}
        accentHex={accentHex}
      />

      {pinVerifyOpen && (
        <PinPad
          mode="verify"
          accentHex={accentHex}
          title="enter pin to view history"
          onCancel={() => setPinVerifyOpen(false)}
          onSubmit={async (pin) => {
            const ok = await verifyPin(pin);
            if (ok) {
              setPinVerifyOpen(false);
              setPinFailCount(0);
              setHistoryOpen(true);
              return true;
            }
            const next = pinFailCount + 1;
            setPinFailCount(next);
            if (next >= 3) {
              setPinVerifyOpen(false);
              setPinFailCount(0);
              setAuthError("try again later");
              setTimeout(() => setAuthError(null), 2000);
            }
            return false;
          }}
        />
      )}
    </>
  );
}
