"use client";
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
import { triggerHaptic, lightImpact } from "@/lib/haptics";
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
  const [historyFlash, setHistoryFlash] = useState(false);
  const [pinFailCount, setPinFailCount] = useState(0);
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
    if (!settings.lockHistory) { setHistoryOpen(true); return; }
    setHistoryFlash(true);
    setTimeout(() => setHistoryFlash(false), 200);
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

  const onPointerMove = useCallback((_e: React.PointerEvent) => {}, []);

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

  const prevSolveMs = useMemo(() => {
    const sorted = [...solves].sort((a, b) => b.timestamp - a.timestamp);
    return sorted.length >= 2 ? sorted[1].time_ms : null;
  }, [solves]);

  const statsVisible = settings.proMode && state !== "running";
  const scrambleVisible = settings.proMode && !!scramble;
  const scrambleOpacity = state === "running" ? 0.18 : 0.6;
  const historyVisible = state !== "running" && state !== "armed";
  const comparisonShown = !!comparisonFull && state !== "running" && state !== "armed";

  return (
    <>
      <main
        className="bg-black touch-none select-none"
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          WebkitUserSelect: "none",
          overscrollBehavior: "none",
        }}
      >
        {/* Bloom */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: mounted ? 1 : 0, transition: "opacity 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
          <Bloom state={state} accentHex={accentHex} />
        </div>

        {/* PB flash — CSS keyframe, no Framer Motion */}
        {state === "pb" && (
          <div
            aria-hidden
            className="fixed inset-0 pointer-events-none tempo-pb-flash"
            style={{ background: accentHex, zIndex: 2 }}
          />
        )}

        {/* Info button */}
        <button
          aria-label="info"
          onClick={() => { void lightImpact(); setInfoOpen(true); }}
          className="font-mono"
          style={{
            position: "absolute",
            top: 10, left: 12, zIndex: 30,
            color: "#F5F0E8",
            opacity: mounted ? 0.35 : 0,
            transition: "opacity 0.2s cubic-bezier(0.4,0,0.2,1) 0.6s",
            fontSize: 14,
            background: "transparent", border: "none", cursor: "pointer",
            width: 44, height: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
            touchAction: "manipulation",
          }}
        >
          ?
        </button>

        {/* Settings button */}
        <button
          aria-label="settings"
          onClick={() => { void lightImpact(); setSettingsOpen(true); }}
          style={{
            position: "absolute",
            top: 10, right: 12, zIndex: 30,
            opacity: mounted ? 0.35 : 0,
            transition: "opacity 0.2s cubic-bezier(0.4,0,0.2,1) 0.6s",
            background: "transparent", border: "none", cursor: "pointer",
            width: 44, height: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
            touchAction: "manipulation",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5F0E8" strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* Scramble */}
        {scrambleVisible && (
          <div
            className="absolute left-0 right-0 flex justify-center px-12"
            style={{
              top: 64,
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

        {/* Timer + new-best + comparison (fixed vertical position, no layout shift) */}
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
            opacity: mounted ? 1 : 0,
            filter: mounted ? "blur(0px)" : "blur(8px)",
            transition: "opacity 0.4s cubic-bezier(0.4,0,0.2,1) 0.2s, filter 0.4s cubic-bezier(0.4,0,0.2,1) 0.2s",
          }}
        >
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <TimerDisplay ms={displayMs} state={state} accentHex={accentHex} />
            {/* new-best: absolute, never pushes layout */}
            <div
              aria-hidden={state !== "pb"}
              className="font-mono"
              style={{
                position: "absolute",
                left: "50%",
                top: "100%",
                transform: "translateX(-50%)",
                marginTop: 14,
                color: accentHex,
                fontSize: 10,
                letterSpacing: "0.3em",
                opacity: state === "pb" ? 1 : 0,
                transition: "opacity 0.6s cubic-bezier(0.4,0,0.2,1)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              new best
            </div>
          </div>

          {/* Comparison slot: fixed space so margin never changes */}
          <div style={{ position: "relative", width: "100%", marginTop: 44, minHeight: 36 }}>
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
                transition: comparisonShown ? "opacity 0.25s ease-out" : "opacity 0.6s ease-in",
                pointerEvents: "none",
              }}
            >
              {typedText}
            </div>
          </div>
        </div>

        {/* Bottom area: pro stats (when proMode) or last solve time + history button */}
        <div
          className="absolute left-0 right-0 font-mono"
          style={{
            bottom: 0,
            zIndex: 25,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: 16,
            pointerEvents: "none",
          }}
        >
          {/* Pro mode: ao5 | last | ao12 row — above history */}
          <div
            className="w-full flex justify-between items-center"
            style={{
              paddingLeft: 24,
              paddingRight: 24,
              marginBottom: 12,
              opacity: statsVisible && lastSolveMs !== null ? 0.55 : 0,
              transition: "opacity 0.3s ease",
              pointerEvents: "none",
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "#F5F0E8",
            }}
          >
            <span style={{ minWidth: 80 }}>{ao5 !== null ? `ao5  ${formatTime(ao5)}` : ""}</span>
            <span>{prevSolveMs !== null ? formatTime(prevSolveMs) : ""}</span>
            <span style={{ minWidth: 80, textAlign: "right" }}>{ao12 !== null ? `ao12 ${formatTime(ao12)}` : ""}</span>
          </div>

          {/* Previous solve (non-pro) */}
          <div
            style={{
              marginBottom: 4,
              opacity: !statsVisible && prevSolveMs !== null && state !== "running" && state !== "armed" ? 1 : 0,
              transition: "opacity 0.3s ease",
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span className="font-mono" style={{ color: "#F5F0E8", fontSize: "0.6rem", letterSpacing: "0.12em", opacity: 0.25 }}>
              prev
            </span>
            <span className="font-mono" style={{ color: "#F5F0E8", fontSize: "0.75rem", letterSpacing: "0.08em", opacity: 0.4 }}>
              {prevSolveMs !== null ? formatTime(prevSolveMs) : ""}
            </span>
          </div>

          {/* History button */}
          <button
            aria-label="open history"
            onClick={() => { void lightImpact(); void openHistoryGated(); }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "8px 24px",
              pointerEvents: historyVisible ? "auto" : "none",
              opacity: historyVisible ? 1 : 0,
              transition: "opacity 0.4s ease",
              touchAction: "manipulation",
            }}
          >
            <span
              className="font-mono"
              style={{
                color: historyFlash ? accentHex : "#F5F0E8",
                fontSize: "0.7rem",
                letterSpacing: "0.12em",
                opacity: historyFlash ? 1 : 0.35,
                transition: "color 0.2s ease, opacity 0.2s ease",
              }}
            >
              history
            </span>
          </button>
        </div>

        {/* Auth error toast — CSS opacity/transform */}
        <div
          className="absolute left-0 right-0 flex justify-center font-mono"
          style={{
            bottom: 80,
            zIndex: 30,
            color: accentHex,
            fontSize: 10,
            letterSpacing: "0.3em",
            pointerEvents: "none",
            opacity: authError ? 1 : 0,
            transform: authError ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.25s ease, transform 0.25s ease",
          }}
        >
          {authError}
        </div>

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

      {/* History panel — always mounted, slides over */}
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
          title="enter biometric code"
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
