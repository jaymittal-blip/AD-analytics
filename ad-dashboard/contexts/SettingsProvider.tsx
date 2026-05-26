"use client";

import {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode,
} from "react";
import { AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";

interface SettingsCtx {
  settings: AppSettings;
  update:   (patch: Partial<AppSettings>) => void;
  save:     () => void;
  discard:  () => void;
  dirty:    boolean;
}

const Ctx = createContext<SettingsCtx | null>(null);

const STORAGE_KEY = "ad-intel-settings-v1";

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

export default function SettingsProvider({ children }: { children: ReactNode }) {
  const [saved,    setSaved]    = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [dirty,    setDirty]    = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        setSaved(parsed);
        setSettings(parsed);
      }
    } catch {}
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(s => ({ ...s, ...patch }));
    setDirty(true);
  }, []);

  const save = useCallback(() => {
    setSettings(s => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      setSaved(s);
      return s;
    });
    setDirty(false);
  }, []);

  const discard = useCallback(() => {
    setSettings(saved);
    setDirty(false);
  }, [saved]);

  return (
    <Ctx.Provider value={{ settings, update, save, discard, dirty }}>
      {children}
    </Ctx.Provider>
  );
}
