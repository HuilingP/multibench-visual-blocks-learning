"use client";

import { useI18n } from "@/lib/i18n";
import { useHelp } from "@/lib/help";
import { Term } from "@/components/Term";

export function BlockHelpCard({ blockId }: { blockId: string }) {
  const { t } = useI18n();
  const { beginnerMode } = useHelp();

  if (!beginnerMode) return null;

  const base = `blockHelp.${blockId}`;
  const what = t(`${base}.what`);
  // Missing keys will render as the key itself; guard a bit:
  if (what === `${base}.what`) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="text-sm font-semibold text-zinc-100">{t("blockHelp.title")}</div>
      <div className="mt-2 text-[12px] leading-5 text-zinc-200">{what}</div>

      <div className="mt-3 space-y-2 text-[11px] text-zinc-300">
        <div>
          <span className="text-zinc-400">{t("blockHelp.howToUse")}</span>：{t(`${base}.how`)}
        </div>
        <div>
          <span className="text-zinc-400">{t("blockHelp.config")}</span>：{t(`${base}.config`)}
        </div>
        <div>
          <span className="text-zinc-400">{t("blockHelp.commonPitfall")}</span>：{t(`${base}.pitfall`)}
        </div>
      </div>

      <div className="mt-3 text-[11px] text-zinc-400">
        相关术语：<Term id="block" /> / <Term id="port" /> / <Term id="portType" /> / <Term id="spec" />
      </div>
    </div>
  );
}

