"use client";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
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

const DELETE_WIDTH = 72;
const DELETE_RED = "#C0392B";

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
  index: number;
  isPB: boolean;
  revealed: boolean;
  onReveal: (id: string | null) => void;
  onDelete: (id: string) => void;
  onShare: (s: Solve) => void;
  accentHex: string;
};

function Row({ solve, index, isPB, revealed, onReveal, onDelete, onShare, accentHex }: RowProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -36) onReveal(solve.id);
    else if (revealed && info.offset.x > 36) onReveal(null);
    else onReveal(revealed ? solve.id : null);
  }

  function pressStart() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => onReveal(solve.id), 500);
  }
  function pressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <div
      className="tempo-row-in"
      style={{
        position: "relative",
        overflow: "hidden",
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* Delete button behind */}
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

      {/* Swipeable row */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -DELETE_WIDTH, right: 0 }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={{ x: revealed ? -DELETE_WIDTH : 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerCancel={pressEnd}
        onPointerLeave={pressEnd}
        className="flex items-baseline justify-between"
        style={{
          paddingTop: 10,
          paddingBottom: 10,
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
          }}
        >
          {formatTime(solve.time_ms)}
        </span>
        <div className="flex items-center gap-3">
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
              opacity: 0.3,
              padding: 4,
              marginLeft: 4,
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
  const [confirmClear, setConfirmClear] = useState(false);
  const [shareData, setShareData] = useState<{ solve: Solve; isPB: boolean; comparison: string } | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  const startYRef = useRef<number | null>(null);

  function onPointerDownContainer(e: React.PointerEvent) {
    startYRef.current = e.clientY;
  }
  function onPointerMoveContainer(e: React.PointerEvent) {
    if (startYRef.current === null) return;
    if (e.clientY - startYRef.current > 80) {
      startYRef.current = null;
      onClose();
    }
  }
  function onPointerUpContainer() {
    startYRef.current = null;
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
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 overflow-y-auto"
          style={{
            background: "rgba(0, 0, 0, 0.98)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
          exit={{ opacity: 0, y: 80, transition: { duration: 0.3, ease: "easeIn" } }}
          onPointerDown={onPointerDownContainer}
          onPointerMove={onPointerMoveContainer}
          onPointerUp={onPointerUpContainer}
          onPointerCancel={onPointerUpContainer}
          onClick={() => setRevealedFor(null)}
        >
          <div
            className="max-w-md mx-auto px-8"
            style={{ paddingTop: 56, paddingBottom: totalSolves > 0 ? 110 : 80 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
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
                  position: "fixed",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  textAlign: "center",
                }}
              >
                <p
                  className="font-serif italic"
                  style={{
                    color: "#F5F0E8",
                    opacity: 0.4,
                    fontSize: 32,
                    padding: "0 32px",
                    textAlign: "center",
                    margin: 0,
                  }}
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
                    padding: "0 32px",
                    textAlign: "center",
                  }}
                >
                  complete your first solve to see history
                </p>
              </div>
            )}

            {(() => {
              let idx = 0;
              return groups.map((g) => (
                <div key={g.label} style={{ marginBottom: 36 }}>
                  <p
                    className="font-mono"
                    style={{
                      color: "#F5F0E8",
                      opacity: 0.35,
                      fontSize: 10,
                      letterSpacing: "0.3em",
                      marginBottom: 14,
                    }}
                  >
                    {g.label}
                  </p>
                  <AnimatePresence initial={true}>
                    {g.items.map((s) => {
                      const i = idx++;
                      return (
                        <Row
                          key={s.id}
                          solve={s}
                          index={i}
                          isPB={pbIds.has(s.id)}
                          revealed={revealedFor === s.id}
                          onReveal={setRevealedFor}
                          onDelete={onDelete}
                          onShare={handleShare}
                          accentHex={accentHex}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
              ));
            })()}
          </div>

          {/* Fixed clear-all footer */}
          {totalSolves > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
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

          {/* Off-screen share card */}
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

          {/* Confirm clear overlay */}
          <AnimatePresence>
            {confirmClear && (
              <motion.div
                className="fixed inset-0 z-[55] flex items-center justify-center px-8"
                style={{
                  background: "rgba(0, 0, 0, 0.95)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
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
                  <div className="flex gap-10 items-center">
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
