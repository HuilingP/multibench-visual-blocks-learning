"use client";

import { useHelp } from "@/lib/help";
import { useI18n } from "@/lib/i18n";

export function BeginnerToggle() {
  const { t } = useI18n();
  const { beginnerMode, setBeginnerMode } = useHelp();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs">
      <div className="text-zinc-400">{t("help.beginnerMode")}</div>
      <button
        onClick={() => setBeginnerMode(true)}
        className={
          beginnerMode
            ? "rounded-md bg-indigo-600 px-2 py-1 text-white"
            : "rounded-md bg-zinc-800 px-2 py-1 text-zinc-100 hover:bg-zinc-700"
        }
      >
        {t("help.beginnerModeOn")}
      </button>
      <button
        onClick={() => setBeginnerMode(false)}
        className={
          !beginnerMode
            ? "rounded-md bg-indigo-600 px-2 py-1 text-white"
            : "rounded-md bg-zinc-800 px-2 py-1 text-zinc-100 hover:bg-zinc-700"
        }
      >
        {t("help.beginnerModeOff")}
      </button>
    </div>
  );
}

