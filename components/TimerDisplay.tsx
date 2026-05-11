"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type Props = {
  ms: number;
  state: "idle" | "armed" | "running" | "stopped" | "pb";
  accentHex: string;
};

function format(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${min}:${sec.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

export function TimerDisplay({ ms, state, accentHex }: Props) {
  const [pbColorActive, setPbColorActive] = useState(false);

  useEffect(() => {
    if (state !== "pb") {
      setPbColorActive(false);
      return;
    }
    setPbColorActive(true);
    const t = setTimeout(() => setPbColorActive(false), 800);
    return () => clearTimeout(t);
  }, [state]);

  const opacity =
    state === "idle" ? 0.7 : state === "armed" ? 1.0 : 1.0;
  const letterSpacing = state === "running" ? "-0.01em" : "0em";
  const textShadow =
    state === "pb" ? `0 0 40px ${accentHex}, 0 0 80px ${accentHex}80` : "none";
  const overshoot = state === "stopped" || state === "pb" ? { scale: [1, 1.02, 1] } : { scale: state === "armed" ? 1.02 : 1 };
  const color = pbColorActive ? accentHex : "#F5F0E8";

  return (
    <motion.div
      className="font-serif italic select-none"
      style={{
        fontWeight: 400,
        letterSpacing,
        textShadow,
        willChange: "transform",
        fontSize: "clamp(64px, 18vw, 180px)",
        lineHeight: 1,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
      animate={{ ...overshoot, opacity, color }}
      transition={{
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1],
        color: { duration: pbColorActive ? 0.25 : 0.8, ease: "easeOut" },
        opacity: { duration: 0.3, ease: "easeOut" },
      }}
    >
      {format(ms)}
    </motion.div>
  );
}
