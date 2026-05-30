"use client";

import {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode,
} from "react";
import { AppSettings, DEFAULT_SETTINGS, CriteriaMap } from "@/lib/settings";

interface SettingsCtx {
  settings:      AppSettings;
  savedSettings: AppSettings;
  update:        (patch: Partial<AppSettings>) => void;
  save:          () => void;
  discard:       () => void;
  dirty:         boolean;
}

const Ctx = createContext<SettingsCtx | null>(null);

// Bump version when defaults change — forces localStorage to be ignored
const STORAGE_KEY = "ad-intel-settings-v3";

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
    async function loadSettings() {
      // 1. Load local UI prefs (visible columns, email) from localStorage
      let local: Partial<AppSettings> = {};
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) local = JSON.parse(raw);
      } catch {}

      // 2. Always fetch criteria from DB — DB is the source of truth for classification
      try {
        const res = await fetch("/api/settings/criteria", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json() as { criteria: CriteriaMap };
          const dbCriteria = data.criteria;
          const merged: AppSettings = {
            ...DEFAULT_SETTINGS,
            ...local,
            criteria: dbCriteria,
          };
          setSaved(merged);
          setSettings(merged);
          return;
        }
      } catch {}

      // Fallback: use localStorage or defaults
      const fallback = { ...DEFAULT_SETTINGS, ...local };
      setSaved(fallback);
      setSettings(fallback);
    }

    loadSettings();
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
    <Ctx.Provider value={{ settings, savedSettings: saved, update, save, discard, dirty }}>
      {children}
    </Ctx.Provider>
  );
}
