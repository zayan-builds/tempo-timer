"use client";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useCallback, useMemo, useRef, useState } from "react";
import { Solve } from "@/hooks/useHistory";
import { formatTime, isValidFormatted } from "@/lib/format";
import { getComparison } from "@/lib/comparison";
import { triggerHaptic } from "@/lib/haptics";
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

const DELETE_WIDTH = 72;
const DELETE_RED = "#C0392B";
const SIDE_PAD = 24;

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
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return ts >= startOfDay(now - sevenDays);
}

type RowProps = {
  solve: Solve;
  isPB: boolean;
  revealed: boolean;
  collapsing: boolean;
  onReveal: (id: string | null) => void;
  onDelete: (id: string) => void;
  onShare: (s: Solve) => void;
  accentHex: string;
};

function Row({ solve, isPB, revealed, collapsing, onReveal, onDelete, onShare, accentHex }: RowProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealedFiredRef = useRef(false);

  function fireRevealHaptic() {
    if (revealedFiredRef.current) return;
    revealedFiredRef.current = true;
    void triggerHaptic("armed");
  }

  function handleDragStart() {
    revealedFiredRef.current = false;
    onReveal(solve.id);
  }
  function handleDrag(_: unknown, info: PanInfo) {
    if (info.offset.x < -DELETE_WIDTH / 2) fireRevealHaptic();
  }
  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -DELETE_WIDTH / 2) onReveal(solve.id);
    else onReveal(null);
  }

  function pressStart() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      fireRevealHaptic();
      onReveal(solve.id);
    }, 500);
  }
  function pressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <div
      className={collapsing ? "tempo-row-collapse" : "tempo-row-in"}
      style={{
        position: "relative",
        overflow: "hidden",
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(solve.id);
        }}
        className="font-mono"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: DELETE_WIDTH,
          background: DELETE_RED,
          color: "#FFFFFF",
          fontSize: 11,
          letterSpacing: "0.18em",
          border: "none",
          cursor: "pointer",
          padding: 0,
          zIndex: 0,
        }}
      >
        del
      </button>

      <motion.div
        layout={false}
        drag="x"
        dragConstraints={{ left: -DELETE_WIDTH, right: 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={{ x: revealed ? -DELETE_WIDTH : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerCancel={pressEnd}
        onPointerLeave={pressEnd}
        className="flex items-center justify-between"
        style={{
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: SIDE_PAD,
          paddingRight: SIDE_PAD,
          background: "#000",
          position: "relative",
          zIndex: 1,
          touchAction: "pan-y",
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
          }}
        >
          {formatTime(solve.time_ms)}
        </span>
        <div className="flex items-center" style={{ gap: 10 }}>
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
            onClick={(e) => {
              e.stopPropagation();
              onShare(solve);
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              opacity: 0.4,
              padding: 4,
              display: "flex",
              alignItems: "center",
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

  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [collapsingId, setCollapsingId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [shareData, setShareData] = useState<{ solve: Solve; isPB: boolean; comparison: string } | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{ y: number; x: number } | null>(null);

  function onHandlePointerDown(e: React.PointerEvent) {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (scrollTop !== 0) return;
    dragRef.current = { y: e.clientY, x: e.clientX };
  }
  function onHandlePointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    const dx = Math.abs(e.clientX - d.x);
    if (dy > 80 && dx < 20) {
      dragRef.current = null;
      onClose();
    } else if (dy < -10 || dx > 30) {
      dragRef.current = null;
    }
  }
  function onHandlePointerUp() {
    dragRef.current = null;
  }

  function handleDeleteWithCollapse(id: string) {
    setCollapsingId(id);
    setTimeout(() => {
      onDelete(id);
      setRevealedFor(null);
      setCollapsingId(null);
    }, 300);
  }

  const handleShare = useCallback(
    async (solve: Solve) => {
      const comparison = getComparison(solve.time_ms / 1000);
      setShareData({ solve, isPB: pbIds.has(solve.id), comparison });
      await new Promise((r) => setTimeout(r, 80));
      const node = shareRef.current;
      if (!node) {
        setShareData(null);
        return;
      }
      try {
        const mod = await import("dom-to-image-more");
        const dataUrl = await mod.default.toPng(node, {
          width: 1200,
          height: 630,
          bgcolor: "#000000",
          cacheBust: true,
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
        inset: 0,
        zIndex: 40,
        background: "#000",
        transform: `translate3d(0, ${open ? "0" : "100%"}, 0)`,
        transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        willChange: "transform",
        pointerEvents: open ? "auto" : "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Dedicated drag handle — only place where pull-down closes the panel */}
      <div
        aria-hidden
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 60,
          zIndex: 50,
          touchAction: "none",
          background: "transparent",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 14,
            transform: "translateX(-50%)",
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "rgba(245,240,232,0.18)",
          }}
        />
      </div>

      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{
          flex: 1,
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
        }}
        onClick={() => setRevealedFor(null)}
      >
        <div
          className="max-w-md mx-auto"
          style={{ paddingTop: 56, paddingBottom: totalSolves > 0 ? 110 : 80 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 28, paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD }}
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

          {totalSolves > 0 && (
            <div
              className="flex items-center justify-start"
              style={{
                marginBottom: 40,
                paddingLeft: SIDE_PAD,
                paddingRight: SIDE_PAD,
                gap: 10,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <span
                className="font-serif italic"
                style={{ color: "#F5F0E8", fontSize: 15, opacity: 0.85, whiteSpace: "nowrap" }}
              >
                {totalSolves} {totalSolves === 1 ? "solve" : "solves"}
              </span>
              <span style={{ color: "#F5F0E8", opacity: 0.25, fontSize: 8 }}>·</span>
              {personalBest !== null && (
                <>
                  <span
                    className="font-mono"
                    style={{ color: accentHex, fontSize: 10, letterSpacing: "0.08em", whiteSpace: "nowrap" }}
                  >
                    best {formatTime(personalBest)}
                  </span>
                  <span style={{ color: "#F5F0E8", opacity: 0.25, fontSize: 8 }}>·</span>
                </>
              )}
              <span
                className="font-mono"
                style={{ color: "#F5F0E8", fontSize: 10, opacity: 0.4, letterSpacing: "0.06em", whiteSpace: "nowrap" }}
              >
                {thisWeekCount} this week
              </span>
            </div>
          )}

          {reversed.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                paddingTop: 80,
                paddingLeft: SIDE_PAD,
                paddingRight: SIDE_PAD,
              }}
            >
              <p
                className="font-serif italic"
                style={{ color: "#F5F0E8", opacity: 0.4, fontSize: 32, margin: 0, textAlign: "center" }}
              >
                no solves yet
              </p>
              <p
                className="font-mono"
                style={{
                  color: "#F5F0E8",
                  opacity: 0.25,
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  marginTop: 16,
                  textAlign: "center",
                }}
              >
                complete your first solve to see history
              </p>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.label} style={{ marginBottom: 36 }}>
              <p
                className="font-mono"
                style={{
                  color: "#F5F0E8",
                  opacity: 0.35,
                  fontSize: 10,
                  letterSpacing: "0.3em",
                  marginBottom: 14,
                  paddingLeft: SIDE_PAD,
                  paddingRight: SIDE_PAD,
                  textAlign: "left",
                }}
              >
                {g.label}
              </p>
              <AnimatePresence initial={true}>
                {g.items.map((s) => (
                  <Row
                    key={s.id}
                    solve={s}
                    isPB={pbIds.has(s.id)}
                    revealed={revealedFor === s.id}
                    collapsing={collapsingId === s.id}
                    onReveal={setRevealedFor}
                    onDelete={handleDeleteWithCollapse}
                    onShare={handleShare}
                    accentHex={accentHex}
                  />
                ))}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

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
            background:
              "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0) 100%)",
            zIndex: 45,
            pointerEvents: "none",
          }}
        >
          <button
            onClick={() => setConfirmClear(true)}
            className="font-mono"
            style={{
              color: DELETE_RED,
              opacity: 0.55,
              fontSize: 10,
              letterSpacing: "0.3em",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "8px 16px",
              pointerEvents: "auto",
            }}
          >
            clear all
          </button>
        </div>
      )}

      {shareData && (
        <div
          style={{
            position: "fixed",
            left: -20000,
            top: 0,
            pointerEvents: "none",
          }}
        >
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

      <AnimatePresence>
        {confirmClear && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center"
            style={{
              background: "rgba(0, 0, 0, 0.95)",
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
              <p
                className="font-serif italic text-center"
                style={{ color: "#F5F0E8", fontSize: 26, marginBottom: 48 }}
              >
                delete all solves?
              </p>
              <div className="flex items-center" style={{ gap: 40 }}>
                <button
                  onClick={() => {
                    onClearAll();
                    setRevealedFor(null);
                    setConfirmClear(false);
                  }}
                  className="font-mono"
                  style={{
                    color: DELETE_RED,
                    fontSize: 12,
                    letterSpacing: "0.3em",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  yes, clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="font-mono"
                  style={{
                    color: "#F5F0E8",
                    opacity: 0.5,
                    fontSize: 12,
                    letterSpacing: "0.3em",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
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
