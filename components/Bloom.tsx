"use client";

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

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function Bloom({ state, accentHex }: Props) {
  const c = config[state];
  const size = c.radius * 2;
  const { r, g, b } = hexToRgb(accentHex);
  const pulsing = state === "armed";

  return (
    <div
      aria-hidden
      className={pulsing ? "tempo-bloom-pulse" : undefined}
      style={{
        position: "fixed",
        top: "45%",
        left: "50%",
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        opacity: c.opacity,
        borderRadius: "9999px",
        pointerEvents: "none",
        background: `radial-gradient(circle, rgba(${r},${g},${b},1) 0%, rgba(${r},${g},${b},0.55) 38%, rgba(${r},${g},${b},0) 72%)`,
        filter: "blur(50px)",
        zIndex: 0,
        transition:
          "width 0.6s cubic-bezier(0.4,0,0.2,1), height 0.6s cubic-bezier(0.4,0,0.2,1), opacity 0.6s cubic-bezier(0.4,0,0.2,1)",
        willChange: "transform, opacity",
      }}
    />
  );
}
