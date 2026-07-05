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

const DAILY_ACCENT_PALETTE: Record<number, AccentName> = {
  0: "amber",
  1: "blue",
  2: "green",
  3: "purple",
  4: "red",
  5: "gold",
  6: "white",
};

export function getDailyAccent(): AccentName {
  return DAILY_ACCENT_PALETTE[new Date().getDay()] ?? "amber";
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

  const effectiveAccent = settings.dailyAccent ? getDailyAccent() : settings.accent;

  const value = useMemo<Ctx>(
    () => ({ settings, update, accentHex: ACCENT_HEX[effectiveAccent] }),
    [settings, update, effectiveAccent],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside provider");
  return ctx;
}
