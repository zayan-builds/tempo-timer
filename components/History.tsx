"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useMemo, useRef, useState } from "react";
import { Solve } from "@/hooks/useHistory";
import { formatTime, isValidFormatted } from "@/lib/format";
import { getComparison } from "@/lib/comparison";
import { ShareCard } from "./ShareCard";

type Props = {
  open: boolean;
  onClose: () => void;
  solves: Solve[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  accentHex: string;
};

type Group = { label: string; items: Solve[] };

const DELETE_RED = "#C0392B";
const SIDE_PAD = 24;
const SWIPE_THRESHOLD = 60;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupSolves(solves: Solve[]): Group[] {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const oldThreshold = startOfDay(now - 180 * 24 * 60 * 60 * 1000);
  const groups = new Map<string, Solve[]>();
  for (const s of solves) {
    const d = startOfDay(s.timestamp);
    let label: string;
    if (d === todayStart) label = "today";
    else if (d === yesterdayStart) label = "yesterday";
    else
      label = new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: d < oldThreshold ? "numeric" : undefined,
      });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(s);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isThisWeek(ts: number): boolean {
  const now = Date.now();
  return ts >= startOfDay(now - 7 * 24 * 60 * 60 * 1000);
}

type RowProps = {
  solve: Solve;
  isPB: boolean;
  pendingDelete: boolean;
  onSwipeDelete: (id: string) => void;
  onShare: (s: Solve) => void;
  accentHex: string;
};

function Row({ solve, isPB, pendingDelete, onSwipeDelete, onShare, accentHex }: RowProps) {
  const dragX = useRef(0);

  return (
    <div
      style={{
        overflow: "hidden",
        maxHeight: pendingDelete ? "0px" : "80px",
        transition: pendingDelete ? "max-height 220ms cubic-bezier(0.4,0,0.2,1)" : "none",
      }}
    >
      <motion.div
        layout={false}
        drag="x"
        dragConstraints={{ left: -400, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDrag={(_, info) => { dragX.current = info.offset.x; }}
        onDragEnd={() => {
          if (dragX.current < -SWIPE_THRESHOLD) {
            onSwipeDelete(solve.id);
          }
        }}
        animate={pendingDelete ? { x: -420, opacity: 0 } : { x: 0, opacity: 1 }}
        transition={
          pendingDelete
            ? { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
            : { type: "spring", stiffness: 400, damping: 40 }
        }
        className="flex items-center justify-between"
        style={{
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: SIDE_PAD,
          paddingRight: SIDE_PAD,
          background: "#000",
          touchAction: "pan-y",
          cursor: "default",
        }}
      >
        <span
          className="font-serif italic"
          style={{
            color: "#F5F0E8",
            fontSize: 30,
            lineHeight: 1.05,
            fontVariantNumeric: "tabular-nums",
            textAlign: "left",
            userSelect: "none",
          }}
        >
          {formatTime(solve.time_ms)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isPB && (
            <span
              className="font-mono"
              style={{ color: accentHex, fontSize: 9, letterSpacing: "0.3em" }}
            >
              pb
            </span>
          )}
          <span
            className="font-mono"
            style={{ color: "#F5F0E8", opacity: 0.4, fontSize: 10, letterSpacing: "0.12em" }}
          >
            {formatClock(solve.timestamp)}
          </span>
          <button
            aria-label="share"
            onClick={(e) => { e.stopPropagation(); onShare(solve); }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              opacity: 0.4,
              padding: 4,
              display: "flex",
              alignItems: "center",
              touchAction: "manipulation",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5F0E8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function History({ open, onClose, solves, onDelete, onClearAll, accentHex }: Props) {
  const validSolves = useMemo(
    () => solves.filter((s) => typeof s.time_ms === "number" && s.time_ms > 0 && isValidFormatted(formatTime(s.time_ms))),
    [solves],
  );
  const reversed = useMemo(() => [...validSolves].sort((a, b) => b.timestamp - a.timestamp), [validSolves]);
  const groups = useMemo(() => groupSolves(reversed), [reversed]);

  const pbIds = useMemo(() => {
    const ids = new Set<string>();
    let best = Infinity;
    const chrono = [...validSolves].sort((a, b) => a.timestamp - b.timestamp);
    let count = 0;
    for (const s of chrono) {
      count++;
      if (count > 1 && s.time_ms < best) ids.add(s.id);
      if (s.time_ms < best) best = s.time_ms;
    }
    return ids;
  }, [validSolves]);

  const totalSolves = validSolves.length;
  const personalBest = useMemo(
    () => (validSolves.length ? Math.min(...validSolves.map((s) => s.time_ms)) : null),
    [validSolves],
  );
  const thisWeekCount = useMemo(
    () => validSolves.filter((s) => isThisWeek(s.timestamp)).length,
    [validSolves],
  );

  const [confirmClear, setConfirmClear] = useState(false);
  const [shareData, setShareData] = useState<{ solve: Solve; isPB: boolean; comparison: string } | null>(null);
  const [undoState, setUndoState] = useState<{ solve: Solve; timerId: ReturnType<typeof setTimeout> } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  function handleSwipeDelete(id: string) {
    const solve = validSolves.find((s) => s.id === id);
    if (!solve) return;
    setPendingDeleteId(id);
    // Give animation time to play, then commit
    const timerId = setTimeout(() => {
      onDelete(id);
      setPendingDeleteId(null);
      setUndoState(null);
    }, 3000);
    // Cancel previous undo if any
    if (undoState) {
      clearTimeout(undoState.timerId);
      onDelete(undoState.solve.id); // commit previous
    }
    setUndoState({ solve, timerId });
  }

  function handleUndo() {
    if (!undoState) return;
    clearTimeout(undoState.timerId);
    setPendingDeleteId(null);
    setUndoState(null);
    // The solve was never actually deleted (we deferred onDelete) — just clearing pending state re-shows it
  }

  const handleShare = useCallback(
    async (solve: Solve) => {
      const comparison = getComparison(solve.time_ms / 1000);
      setShareData({ solve, isPB: pbIds.has(solve.id), comparison });
      await new Promise((r) => setTimeout(r, 80));
      const node = shareRef.current;
      if (!node) { setShareData(null); return; }
      try {
        const mod = await import("dom-to-image-more");
        const dataUrl = await mod.default.toPng(node, {
          width: 1200, height: 630, bgcolor: "#000000", cacheBust: true,
        });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `tempo-${formatTime(solve.time_ms).replace(/[:.]/g, "-")}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.error("share failed", err);
      } finally {
        setShareData(null);
      }
    },
    [pbIds],
  );

  return (
    <div
      aria-hidden={!open}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        height: "92dvh",
        background: "#000",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        transform: `translate3d(0, ${open ? "0" : "100%"}, 0)`,
        transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        willChange: "transform",
        pointerEvents: open ? "auto" : "none",
        display: "flex",
        flexDirection: "column",
        boxShadow: open ? "0 -4px 40px rgba(0,0,0,0.6)" : "none",
      }}
    >
      {/* Drag handle / close strip */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "12px 0 4px",
          flexShrink: 0,
          cursor: "pointer",
        }}
        onClick={onClose}
        role="button"
        aria-label="close history"
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "rgba(245,240,232,0.22)",
          }}
        />
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `12px ${SIDE_PAD}px 16px`,
          flexShrink: 0,
        }}
      >
        <span
          className="font-mono italic"
          style={{ color: "#F5F0E8", fontSize: 11, letterSpacing: "0.3em", opacity: 0.85 }}
        >
          history
        </span>
        <button
          onClick={onClose}
          className="font-mono"
          style={{
            color: accentHex, fontSize: 11, letterSpacing: "0.3em",
            background: "transparent", border: "none", cursor: "pointer",
            padding: 0, touchAction: "manipulation",
          }}
        >
          close
        </button>
      </div>

      {/* Stats */}
      {totalSolves > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingLeft: SIDE_PAD,
            paddingRight: SIDE_PAD,
            paddingBottom: 24,
            whiteSpace: "nowrap",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <span className="font-serif italic" style={{ color: "#F5F0E8", fontSize: 15, opacity: 0.85 }}>
            {totalSolves} {totalSolves === 1 ? "solve" : "solves"}
          </span>
          <span style={{ color: "#F5F0E8", opacity: 0.25, fontSize: 8 }}>·</span>
          {personalBest !== null && (
            <>
              <span className="font-mono" style={{ color: accentHex, fontSize: 10, letterSpacing: "0.08em" }}>
                best {formatTime(personalBest)}
              </span>
              <span style={{ color: "#F5F0E8", opacity: 0.25, fontSize: 8 }}>·</span>
            </>
          )}
          <span className="font-mono" style={{ color: "#F5F0E8", fontSize: 10, opacity: 0.4, letterSpacing: "0.06em" }}>
            {thisWeekCount} this week
          </span>
        </div>
      )}

      {/* Scroll list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
        }}
      >
        {reversed.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD, textAlign: "center" }}>
            <p className="font-serif italic" style={{ color: "#F5F0E8", opacity: 0.4, fontSize: 32, margin: 0 }}>no solves yet</p>
            <p className="font-mono" style={{ color: "#F5F0E8", opacity: 0.25, fontSize: 10, letterSpacing: "0.18em", marginTop: 16 }}>
              complete your first solve to see history
            </p>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.label} style={{ marginBottom: 32 }}>
            <p
              className="font-mono"
              style={{
                color: "#F5F0E8", opacity: 0.35, fontSize: 10,
                letterSpacing: "0.3em", marginBottom: 12,
                paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD, textAlign: "left",
              }}
            >
              {g.label}
            </p>
            {g.items.map((s) => (
              <Row
                key={s.id}
                solve={s}
                isPB={pbIds.has(s.id)}
                pendingDelete={pendingDeleteId === s.id}
                onSwipeDelete={handleSwipeDelete}
                onShare={handleShare}
                accentHex={accentHex}
              />
            ))}
          </div>
        ))}
        <div style={{ height: 80 }} />
      </div>

      {/* Footer: clear-all */}
      {totalSolves > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            paddingTop: 14,
            paddingBottom: 22,
            background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0) 100%)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <button
            onClick={() => setConfirmClear(true)}
            className="font-mono"
            style={{
              color: DELETE_RED, opacity: 0.55, fontSize: 10, letterSpacing: "0.3em",
              background: "transparent", border: "none", cursor: "pointer",
              padding: "8px 16px", pointerEvents: "auto", touchAction: "manipulation",
            }}
          >
            clear all
          </button>
        </div>
      )}

      {/* Undo toast */}
      <AnimatePresence>
        {undoState && (
          <motion.div
            key="undo-toast"
            style={{
              position: "absolute",
              bottom: 48,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(30,30,30,0.96)",
              border: "1px solid rgba(245,240,232,0.12)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "10px 16px",
              zIndex: 60,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
              pointerEvents: "auto",
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
          >
            <span className="font-mono" style={{ color: "#F5F0E8", opacity: 0.55, fontSize: 10, letterSpacing: "0.15em" }}>
              solve deleted
            </span>
            <button
              onClick={handleUndo}
              className="font-mono"
              style={{
                color: accentHex, fontSize: 10, letterSpacing: "0.2em",
                background: "transparent", border: "none", cursor: "pointer",
                padding: 0, touchAction: "manipulation",
              }}
            >
              undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share card (off-screen) */}
      {shareData && (
        <div style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          <ShareCard
            ref={shareRef}
            timeMs={shareData.solve.time_ms}
            isPB={shareData.isPB}
            comparison={shareData.comparison}
            event={(shareData.solve.event || "3x3").replace("x", "×")}
            accentHex={accentHex}
          />
        </div>
      )}

      {/* Confirm clear */}
      <AnimatePresence>
        {confirmClear && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center"
            style={{
              background: "rgba(0,0,0,0.95)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              paddingLeft: SIDE_PAD,
              paddingRight: SIDE_PAD,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <p className="font-serif italic text-center" style={{ color: "#F5F0E8", fontSize: 26, marginBottom: 48 }}>
                delete all solves?
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
                <button
                  onClick={() => { onClearAll(); setConfirmClear(false); }}
                  className="font-mono"
                  style={{
                    color: DELETE_RED, fontSize: 12, letterSpacing: "0.3em",
                    background: "transparent", border: "none", cursor: "pointer", padding: 0, touchAction: "manipulation",
                  }}
                >
                  yes, clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="font-mono"
                  style={{
                    color: "#F5F0E8", opacity: 0.5, fontSize: 12, letterSpacing: "0.3em",
                    background: "transparent", border: "none", cursor: "pointer", padding: 0, touchAction: "manipulation",
                  }}
                >
                  cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
