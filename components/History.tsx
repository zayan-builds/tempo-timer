"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useRef } from "react";
import { Solve } from "@/hooks/useHistory";
import { formatTime } from "@/lib/format";

type Props = {
  open: boolean;
  onClose: () => void;
  solves: Solve[];
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
  const groups = new Map<string, Solve[]>();
  for (const s of solves) {
    const d = startOfDay(s.timestamp);
    let label: string;
    if (d === todayStart) label = "today";
    else if (d === yesterdayStart) label = "yesterday";
    else {
      label = new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: d < startOfDay(now - 180 * 24 * 60 * 60 * 1000) ? "numeric" : undefined,
      });
    }
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(s);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function History({ open, onClose, solves, accentHex }: Props) {
  const reversed = useMemo(() => [...solves].sort((a, b) => b.timestamp - a.timestamp), [solves]);
  const groups = useMemo(() => groupSolves(reversed), [reversed]);

  // PB set: track best at each point in time chronologically; mark which solves were PBs at the moment of completion.
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

  const startYRef = useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    startYRef.current = e.clientY;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startYRef.current === null) return;
    if (e.clientY - startYRef.current > 80) {
      startYRef.current = null;
      onClose();
    }
  }
  function onPointerUp() {
    startYRef.current = null;
  }

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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="max-w-md mx-auto px-8" style={{ paddingTop: 56, paddingBottom: 80 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 36 }}>
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

            {reversed.length === 0 && (
              <p
                className="font-mono"
                style={{ color: "#F5F0E8", opacity: 0.4, fontSize: 12, letterSpacing: "0.06em" }}
              >
                no solves yet.
              </p>
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
                {g.items.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-baseline justify-between"
                    style={{ paddingTop: 10, paddingBottom: 10 }}
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
                      {pbIds.has(s.id) && (
                        <span
                          className="font-mono"
                          style={{
                            color: accentHex,
                            fontSize: 9,
                            letterSpacing: "0.3em",
                          }}
                        >
                          pb
                        </span>
                      )}
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
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
