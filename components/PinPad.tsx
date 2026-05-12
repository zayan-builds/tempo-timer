"use client";
import { useState } from "react";

type Mode = "set" | "verify";

type Props = {
  mode: Mode;
  accentHex: string;
  onCancel: () => void;
  onSubmit: (pin: string) => Promise<boolean> | boolean;
  title: string;
};

export function PinPad({ mode, accentHex, onCancel, onSubmit, title }: Props) {
  const [stage, setStage] = useState<"first" | "confirm">("first");
  const [first, setFirst] = useState("");
  const [current, setCurrent] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function commit(pin: string) {
    if (mode === "set") {
      if (stage === "first") {
        setFirst(pin);
        setCurrent("");
        setStage("confirm");
        return;
      }
      if (pin !== first) {
        setError("codes don't match");
        setCurrent("");
        setFirst("");
        setStage("first");
        return;
      }
      await onSubmit(pin);
    } else {
      const ok = await onSubmit(pin);
      if (!ok) {
        setError("incorrect");
        setCurrent("");
      }
    }
  }

  function press(key: string) {
    setError(null);
    if (key === "del") {
      setCurrent((c) => c.slice(0, -1));
      return;
    }
    if (current.length >= 4) return;
    const next = current + key;
    setCurrent(next);
    if (next.length === 4) setTimeout(() => commit(next), 120);
  }

  const prompt =
    mode === "set"
      ? stage === "first"
        ? "set a 4-digit pin"
        : "confirm your pin"
      : title;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8"
      style={{ background: "rgba(0, 0, 0, 0.98)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <p
        className="font-mono"
        style={{ color: accentHex, fontSize: 11, letterSpacing: "0.3em", marginBottom: 36 }}
      >
        {prompt}
      </p>

      <div className="flex gap-4 mb-12">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: i < current.length ? accentHex : "transparent",
              border: `1px solid ${i < current.length ? accentHex : "rgba(245,240,232,0.3)"}`,
              transition: "all 150ms",
            }}
          />
        ))}
      </div>

      {error && (
        <p
          className="font-mono"
          style={{ color: "#F5F0E8", opacity: 0.6, fontSize: 11, letterSpacing: "0.2em", marginBottom: 16 }}
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-x-10 gap-y-6">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button
            key={n}
            onClick={() => press(n)}
            className="font-serif italic"
            style={{
              color: "#F5F0E8",
              background: "transparent",
              border: "none",
              fontSize: 28,
              width: 56,
              height: 56,
              cursor: "pointer",
            }}
          >
            {n}
          </button>
        ))}
        <button
          onClick={onCancel}
          className="font-mono"
          style={{
            color: "#F5F0E8",
            opacity: 0.5,
            background: "transparent",
            border: "none",
            fontSize: 10,
            letterSpacing: "0.2em",
            width: 56,
            height: 56,
            cursor: "pointer",
          }}
        >
          cancel
        </button>
        <button
          onClick={() => press("0")}
          className="font-serif italic"
          style={{
            color: "#F5F0E8",
            background: "transparent",
            border: "none",
            fontSize: 28,
            width: 56,
            height: 56,
            cursor: "pointer",
          }}
        >
          0
        </button>
        <button
          onClick={() => press("del")}
          className="font-mono"
          style={{
            color: "#F5F0E8",
            opacity: 0.5,
            background: "transparent",
            border: "none",
            fontSize: 10,
            letterSpacing: "0.2em",
            width: 56,
            height: 56,
            cursor: "pointer",
          }}
        >
          del
        </button>
      </div>
    </div>
  );
}
