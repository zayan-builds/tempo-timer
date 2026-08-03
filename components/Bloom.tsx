"use client";

type Props = {
  state: "idle" | "armed" | "running" | "stopped" | "pb";
  accentHex: string;
};

// Intent-calibrated bloom — clearly present, never loud:
//  idle    — soft ambient presence
//  armed   — inviting, gentle pulse ("ready, release me")
//  running — quiet so it never distracts mid-solve
//  stopped — settled acknowledgment, a touch more present than idle
//  pb      — the one genuine burst, plus an outer halo
//
// Rendered as a layered radial-gradient (no CSS filter blur — filters cause
// banding and a "cheap" surface on large soft glows). Multiple alpha stops
// give a smooth, premium falloff that sits behind the timer and never
// competes with it.
const config = {
  idle: { radius: 170, opacity: 0.14 },
  armed: { radius: 250, opacity: 0.3 },
  running: { radius: 140, opacity: 0.09 },
  stopped: { radius: 190, opacity: 0.18 },
  pb: { radius: 320, opacity: 0.42 },
} as const;

const PB_OUTER = { radius: 460, opacity: 0.1 };

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
    background: `radial-gradient(circle, rgba(${r},${g},${b},0.9) 0%, rgba(${r},${g},${b},0.4) 30%, rgba(${r},${g},${b},0.12) 55%, rgba(${r},${g},${b},0.03) 72%, rgba(${r},${g},${b},0) 78%)`,
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
