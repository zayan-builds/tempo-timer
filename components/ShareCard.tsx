"use client";
import { forwardRef } from "react";
import { formatTime } from "@/lib/format";

type Props = {
  timeMs: number;
  isPB: boolean;
  comparison: string;
  event: string;
  accentHex: string;
};

export const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard(
  { timeMs, isPB, comparison, event, accentHex },
  ref,
) {
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: 1200,
        height: 630,
        background: "#000000",
        color: "#F5F0E8",
        overflow: "hidden",
        fontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
      }}
    >
      {/* Accent radial bloom centered behind the time */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "45%",
          width: 400,
          height: 400,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${accentHex} 0%, ${accentHex}55 35%, transparent 70%)`,
          filter: "blur(60px)",
          opacity: 0.08,
          pointerEvents: "none",
        }}
      />

      {/* Corner marks - lowercase */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 64,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.3em",
          color: "#F5F0E8",
          opacity: 0.5,
        }}
      >
        tempo
      </div>
      <div
        style={{
          position: "absolute",
          top: 56,
          right: 64,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.3em",
          color: "#F5F0E8",
          opacity: 0.5,
        }}
      >
        {event}
      </div>

      {/* Center stack */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "45%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isPB && (
          <>
            <div
              style={{
                width: 100,
                height: 1,
                background: accentHex,
                opacity: 0.4,
                marginBottom: 20,
              }}
            />
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.3em",
                color: accentHex,
                marginBottom: 28,
              }}
            >
              personal best
            </div>
          </>
        )}
        <div
          style={{
            fontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 170,
            color: "#F5F0E8",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.005em",
          }}
        >
          {formatTime(timeMs)}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontStyle: "italic",
            fontSize: 12,
            letterSpacing: "0.06em",
            color: accentHex,
            marginTop: 32,
            textAlign: "center",
            lineHeight: 1.4,
            maxWidth: 800,
          }}
        >
          {comparison}
        </div>
      </div>

      {/* Bottom right tag - lowercase */}
      <div
        style={{
          position: "absolute",
          bottom: 56,
          right: 64,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "#F5F0E8",
          opacity: 0.25,
        }}
      >
        tempo . cube timer
      </div>

      {/* Noise/grain overlay */}
      <svg
        width="1200"
        height="630"
        style={{ position: "absolute", inset: 0, opacity: 0.03, pointerEvents: "none" }}
      >
        <filter id="tempo-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#tempo-grain)" />
      </svg>
    </div>
  );
});
