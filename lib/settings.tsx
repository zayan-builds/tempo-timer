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
  | "white"
  | "purple"
  | "rose"
  | "gold"
  | "teal"
  | "orange";

export const ACCENT_HEX: Record<AccentName, string> = {
  amber: "#C8853A",
  blue: "#5B8DBF",
  green: "#6FA86F",
  red: "#C8553A",
  white: "#F5F0E8",
  purple: "#9B59B6",
  rose: "#E91E8C",
  gold: "#F1C40F",
  teal: "#1ABC9C",
  orange: "#E67E22",
};

export type Settings = {
  proMode: boolean;
  haptics: boolean;
  holdMs: 300 | 500 | 750;
  accent: AccentName;
  encryptHistory: boolean;
  lockHistory: boolean;
  lockMethod: "none" | "biometric" | "pin";
};

const DEFAULTS: Settings = {
  proMode: false,
  haptics: true,
  holdMs: 500,
  accent: "amber",
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

  const value = useMemo<Ctx>(
    () => ({ settings, update, accentHex: ACCENT_HEX[settings.accent] }),
    [settings, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside provider");
  return ctx;
}
