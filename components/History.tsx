"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useMemo, useRef, useState } from "react";
import { Solve } from "@/hooks/useHistory";
import { formatTime } from "@/lib/format";
import { getComparison } from "@/lib/comparison";
import { ShareCard } from "./ShareCard";

type Props = {
  open: boolean;
  onClose: () => void;
  solves: Solve[];
  onDelete: (id: string) => void;
  accentHex: string;
};

type Group = { label: string; items: Solve[] };

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

export function History({ open, onClose, solves, onDelete, accentHex }: Props) {
  const reversed = useMemo(() => [...solves].sort((a, b) => b.timestamp - a.timestamp), [solves]);
  const groups = useMemo(() => groupSolves(reversed), [reversed]);

  const pbIds = useMemo(() => {
    const ids = new Set<string>();
    let best = Infinity;
    const chrono = [...solves].sort((a, b) => a.timestamp - b.timestamp);
    let count = 0;
    for (const s of chrono) {
      count++;
      if (count > 1 && s.time_ms < best) ids.add(s.id);
      if (s.time_ms < best) best = s.time_ms;
    }
    return ids;
  }, [solves]);

  const totalSolves = solves.length;
  const personalBest = useMemo(
    () => (solves.length ? Math.min(...solves.map((s) => s.time_ms)) : null),
    [solves],
  );
  const thisWeekCount = useMemo(() => solves.filter((s) => isThisWeek(s.timestamp)).length, [solves]);

  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const [shareData, setShareData] = useState<{ solve: Solve; isPB: boolean; comparison: string } | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function rowPressStart(id: string) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => setDeleteFor(id), 500);
  }
  function rowPressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
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
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onPointerDown={onPointerDownContainer}
          onPointerMove={onPointerMoveContainer}
          onPointerUp={onPointerUpContainer}
          onPointerCancel={onPointerUpContainer}
        >
          <div className="max-w-md mx-auto px-8" style={{ paddingTop: 56, paddingBottom: 80 }}>
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

            {/* Stats bar */}
            {totalSolves > 0 && (
              <div
                className="flex items-center"
                style={{
                  marginBottom: 40,
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="font-serif italic"
                  style={{ color: "#F5F0E8", fontSize: 18, opacity: 0.85 }}
                >
                  {totalSolves} {totalSolves === 1 ? "solve" : "solves"}
                </span>
                <span style={{ color: "#F5F0E8", opacity: 0.25, fontSize: 8 }}>•</span>
                {personalBest !== null && (
                  <>
                    <span
                      className="font-mono"
                      style={{ color: accentHex, fontSize: 11, letterSpacing: "0.1em" }}
                    >
                      best {formatTime(personalBest)}
                    </span>
                    <span style={{ color: "#F5F0E8", opacity: 0.25, fontSize: 8 }}>•</span>
                  </>
                )}
                <span
                  className="font-mono"
                  style={{ color: "#F5F0E8", fontSize: 11, opacity: 0.4, letterSpacing: "0.08em" }}
                >
                  {thisWeekCount} this week
                </span>
              </div>
            )}

            {/* Empty state */}
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
                }}
              >
                <p
                  className="font-serif italic"
                  style={{ color: "#F5F0E8", opacity: 0.4, fontSize: 32 }}
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
                  }}
                >
                  {g.label}
                </p>
                <AnimatePresence initial={false}>
                  {g.items.map((s) => {
                    const isDeleteMode = deleteFor === s.id;
                    return (
                      <motion.div
                        key={s.id}
                        className="flex items-baseline justify-between"
                        style={{ paddingTop: 10, paddingBottom: 10 }}
                        initial={{ opacity: 1, x: 0 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        onPointerDown={() => rowPressStart(s.id)}
                        onPointerUp={rowPressEnd}
                        onPointerCancel={rowPressEnd}
                        onPointerLeave={rowPressEnd}
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
                          {formatTime(s.time_ms)}
                        </span>
                        <div className="flex items-center gap-3">
                          {pbIds.has(s.id) && !isDeleteMode && (
                            <span
                              className="font-mono"
                              style={{ color: accentHex, fontSize: 9, letterSpacing: "0.3em" }}
                            >
                              pb
                            </span>
                          )}
                          {!isDeleteMode && (
                            <span
                              className="font-mono"
                              style={{
                                color: "#F5F0E8",
                                opacity: 0.4,
                                fontSize: 10,
                                letterSpacing: "0.12em",
                              }}
                            >
                              {formatClock(s.timestamp)}
                            </span>
                          )}
                          {!isDeleteMode && (
                            <button
                              aria-label="share"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleShare(s);
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
                          )}
                          {isDeleteMode && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(s.id);
                                  setDeleteFor(null);
                                }}
                                className="font-mono"
                                style={{
                                  color: "#C8553A",
                                  fontSize: 10,
                                  letterSpacing: "0.3em",
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                delete
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteFor(null);
                                }}
                                className="font-mono"
                                style={{
                                  color: "#F5F0E8",
                                  opacity: 0.4,
                                  fontSize: 10,
                                  letterSpacing: "0.3em",
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                cancel
                              </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}
          </div>

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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
