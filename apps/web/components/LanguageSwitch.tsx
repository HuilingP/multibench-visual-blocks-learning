"use client";

import { useI18n, type Locale } from "@/lib/i18n";

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();

  function pick(l: Locale) {
    setLocale(l);
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs">
      <div className="text-zinc-400">{t("common.language")}</div>
      <button
        onClick={() => pick("zh-CN")}
        className={locale === "zh-CN" ? "rounded-md bg-indigo-600 px-2 py-1 text-white" : "rounded-md bg-zinc-800 px-2 py-1 text-zinc-100 hover:bg-zinc-700"}
      >
        {t("common.zhCN")}
      </button>
      <button
        onClick={() => pick("en-US")}
        className={locale === "en-US" ? "rounded-md bg-indigo-600 px-2 py-1 text-white" : "rounded-md bg-zinc-800 px-2 py-1 text-zinc-100 hover:bg-zinc-700"}
      >
        {t("common.enUS")}
      </button>
    </div>
  );
}

