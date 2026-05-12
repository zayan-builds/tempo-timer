"use client";
import { useEffect, useRef, useState } from "react";

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
  return `${min | 0}:${String(sec | 0).padStart(2, "0")}.${String(cs | 0).padStart(2, "0")}`;
}

export function TimerDisplay({ ms, state, accentHex }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pbColor, setPbColor] = useState(false);

  // Scale overshoot via CSS animation class on stop/pb
  useEffect(() => {
    if (state !== "stopped" && state !== "pb") return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("timer-stop-overshoot");
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add("timer-stop-overshoot");
  }, [state]);

  // PB color flash
  useEffect(() => {
    if (state !== "pb") { setPbColor(false); return; }
    setPbColor(true);
    const t = setTimeout(() => setPbColor(false), 800);
    return () => clearTimeout(t);
  }, [state]);

  const opacity = state === "idle" ? 0.7 : 1;
  const color = pbColor ? accentHex : "#F5F0E8";
  const textShadow = state === "pb" ? `0 0 40px ${accentHex}, 0 0 80px ${accentHex}80` : "none";
  const scale = state === "armed" ? "scale(1.02)" : "scale(1)";

  return (
    <div
      ref={ref}
      className="font-serif italic select-none"
      style={{
        fontWeight: 400,
        fontSize: "clamp(64px, 18vw, 180px)",
        lineHeight: 1,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: state === "running" ? "-0.01em" : "0em",
        color,
        opacity,
        textShadow,
        transform: scale,
        transition: [
          "color 0.3s ease",
          "opacity 0.3s ease",
          "transform 0.2s ease",
          "text-shadow 0.3s ease",
        ].join(", "),
        willChange: "transform",
      }}
    >
      {format(ms)}
    </div>
  );
}
