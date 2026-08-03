"use client";

type Props = {
  state: "idle" | "armed" | "running" | "stopped" | "pb";
  accentHex: string;
};

// Intent-calibrated bloom:
//  idle    — soft ambient presence, barely there
//  armed   — inviting pulse: "ready, release me"
//  running — calm and quiet so it never distracts during the solve
//  stopped — settled acknowledgment, slightly more present than idle
//  pb      — genuine burst: brightest and biggest, plus an outer halo
const config = {
  idle: { radius: 150, opacity: 0.07 },
  armed: { radius: 230, opacity: 0.26 },
  running: { radius: 120, opacity: 0.07 },
  stopped: { radius: 160, opacity: 0.12 },
  pb: { radius: 300, opacity: 0.3 },
} as const;

const PB_OUTER = { radius: 430, opacity: 0.14 };

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
  const glow = (radius: number) => ({
    width: radius * 2,
    height: radius * 2,
    background: `radial-gradient(circle, rgba(${r},${g},${b},1) 0%, rgba(${r},${g},${b},0.55) 38%, rgba(${r},${g},${b},0) 72%)`,
    filter: "blur(50px)",
  });

  return (
    <>
      {state === "pb" && (
        <div
          aria-hidden
          className="tempo-stage-bloom"
          style={{
            position: "fixed",
            top: "45%",
            left: "50%",
            ...glow(PB_OUTER.radius),
            transform: "translate(-50%, -50%)",
            opacity: PB_OUTER.opacity,
            borderRadius: "9999px",
            pointerEvents: "none",
            zIndex: 0,
            willChange: "transform, opacity",
          }}
        />
      )}
      <div
        aria-hidden
        className={pulsing ? "tempo-bloom-pulse" : undefined}
        style={{
          position: "fixed",
          top: "45%",
          left: "50%",
          ...glow(c.radius),
          transform: "translate(-50%, -50%)",
          opacity: c.opacity,
          borderRadius: "9999px",
          pointerEvents: "none",
          zIndex: 0,
          transition:
            "width 0.6s cubic-bezier(0.4,0,0.2,1), height 0.6s cubic-bezier(0.4,0,0.2,1), opacity 0.6s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform, opacity",
        }}
      />
    </>
  );
}
