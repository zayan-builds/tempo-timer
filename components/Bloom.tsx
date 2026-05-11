"use client";
import { motion, type TargetAndTransition, type Transition } from "framer-motion";

type Props = {
  state: "idle" | "armed" | "running" | "stopped" | "pb";
  accentHex: string;
};

const config = {
  idle: { radius: 140, opacity: 0.09 },
  armed: { radius: 220, opacity: 0.22 },
  running: { radius: 130, opacity: 0.09 },
  stopped: { radius: 110, opacity: 0.1 },
  pb: { radius: 280, opacity: 0.22 },
} as const;

const SPRING = { type: "spring", stiffness: 60, damping: 20 } as const;

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function Bloom({ state, accentHex }: Props) {
  const c = config[state];
  const size = c.radius * 2;
  const { r, g, b } = hexToRgb(accentHex);

  const animate: TargetAndTransition = {
    width: size,
    height: size,
    opacity: c.opacity,
  };
  let transition: Transition = SPRING;

  if (state === "armed") {
    animate.opacity = [0.18, 0.28, 0.18];
    animate.scale = [0.95, 1.05, 0.95];
    transition = { duration: 1.6, repeat: Infinity, ease: "easeInOut" };
  } else if (state === "running") {
    animate.scale = [0.95, 1.05, 0.95];
    transition = { duration: 2, repeat: Infinity, ease: "easeInOut" };
  }

  return (
    <motion.div
      aria-hidden
      style={{
        position: "fixed",
        top: "45%",
        left: "50%",
        x: "-50%",
        y: "-50%",
        borderRadius: "9999px",
        pointerEvents: "none",
        background: `radial-gradient(circle, rgba(${r},${g},${b},1) 0%, rgba(${r},${g},${b},0.55) 38%, rgba(${r},${g},${b},0) 72%)`,
        filter: "blur(50px)",
        zIndex: 0,
      }}
      initial={{ width: 280, height: 280, opacity: 0.09, scale: 1 }}
      animate={animate}
      transition={transition}
    />
  );
}
