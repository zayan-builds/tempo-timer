"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AccentName =
  | "amber"
  | "blue"
  | "green"
  | "red"
  | "purple"
  | "white"
  | "gold";

export const ACCENT_HEX: Record<AccentName, string> = {
  amber: "#C8853A",
  blue: "#4A90D9",
  green: "#4CAF50",
  red: "#E53935",
  purple: "#9B59B6",
  white: "#F5F0E8",
  gold: "#D4A543",
};

// ── Daily accent: a unique color for every day of the year ──
// The old table keyed on getDay() (day of the WEEK), so colors repeated every
// 7 days. Instead we walk the hue wheel by the golden angle (137.508°), which
// is incommensurate with 360° — day-of-year 1..365 each land on a distinct
// hue, so a color never repeats until a full year has passed. Fixed
// saturation / lightness keep every result muted and premium on the black UI.

const GOLDEN_ANGLE = 137.508;

const HUE_NAMES: Array<[start: number, name: string]> = [
  [0, "rosewood"],
  [28, "clay"],
  [58, "antique gold"],
  [88, "sage"],
  [120, "moss"],
  [150, "eucalyptus"],
  [178, "steel blue"],
  [210, "cerulean"],
  [240, "indigo"],
  [270, "lavender"],
  [300, "plum"],
  [330, "berry"],
];

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

function dayOfYear(now = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

function dailyHue(now = new Date()): number {
  return (dayOfYear(now) * GOLDEN_ANGLE) % 360;
}

function hueName(h: number): string {
  for (let i = 0; i < HUE_NAMES.length; i++) {
    const [start, name] = HUE_NAMES[i];
    const next = HUE_NAMES[(i + 1) % HUE_NAMES.length][0];
    const span = (next - start + 360) % 360;
    if (((h - start + 360) % 360) < span) return name;
  }
  return "amber";
}

export function getDailyAccent(now = new Date()): string {
  return hslToHex(dailyHue(now), 52, 60);
}

export function getDailyAccentName(now = new Date()): string {
  return hueName(dailyHue(now));
}

export type Settings = {
  proMode: boolean;
  haptics: boolean;
  holdMs: 300 | 500 | 750;
  accent: AccentName;
  dailyAccent: boolean;
  encryptHistory: boolean;
  lockHistory: boolean;
  lockMethod: "none" | "biometric" | "pin";
};

const DEFAULTS: Settings = {
  proMode: false,
  haptics: true,
  holdMs: 500,
  accent: "amber",
  dailyAccent: false,
  encryptHistory: false,
  lockHistory: false,
  lockMethod: "none",
};

const STORAGE_KEY = "tempo-settings-v2";

type Ctx = {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  accentHex: string;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const effectiveAccent = settings.dailyAccent ? getDailyAccent() : ACCENT_HEX[settings.accent];

  const value = useMemo<Ctx>(
    () => ({ settings, update, accentHex: effectiveAccent }),
    [settings, update, effectiveAccent],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside provider");
  return ctx;
}
