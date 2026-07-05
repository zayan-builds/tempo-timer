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

export const DAILY_ACCENT_HEX: Record<number, string> = {
  0: "#D4865D",
  1: "#5B8FA8",
  2: "#6BBF8A",
  3: "#B883CD",
  4: "#D65E5E",
  5: "#C9A84C",
  6: "#E8DED0",
};

const DAILY_ACCENT_NAMES: Record<number, string> = {
  0: "terracotta",
  1: "steel blue",
  2: "sage",
  3: "lavender",
  4: "rose",
  5: "antique gold",
  6: "cream",
};

export function getDailyAccent(): string {
  return DAILY_ACCENT_HEX[new Date().getDay()] ?? ACCENT_HEX.amber;
}

export function getDailyAccentName(): string {
  return DAILY_ACCENT_NAMES[new Date().getDay()] ?? "amber";
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
