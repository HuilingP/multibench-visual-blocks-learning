"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import enUS from "@/messages/en-US.json";
import zhCN from "@/messages/zh-CN.json";

export type Locale = "zh-CN" | "en-US";

type Messages = Record<string, unknown>;

type I18nValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const COOKIE_NAME = "mb_locale";

const MESSAGES: Record<Locale, Messages> = {
  "zh-CN": zhCN as Messages,
  "en-US": enUS as Messages
};

function normalizeLocale(input: string | undefined | null): Locale {
  if (input === "en-US") return "en-US";
  return "zh-CN";
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as any)[p];
  }
  return cur;
}

function formatTemplate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale?: string; children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(initialLocale));

  const messages = useMemo(() => MESSAGES[locale], [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const v = getByPath(messages, key);
      if (typeof v === "string") return formatTemplate(v, vars);
      return key; // fail-open for missing keys
    },
    [messages]
  );

  useEffect(() => {
    try {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
  }, [locale]);

  const value = useMemo<I18nValue>(() => ({ locale, setLocale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n must be used within I18nProvider");
  return v;
}

