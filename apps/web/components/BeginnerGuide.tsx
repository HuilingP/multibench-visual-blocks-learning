"use client";

import clsx from "clsx";

import { useI18n } from "@/lib/i18n";
import { useHelp } from "@/lib/help";
import { Term } from "@/components/Term";

export function BeginnerGuide({
  steps,
  onLoadTemplate,
  onClear
}: {
  steps: { id: string; label: string; done: boolean }[];
  onLoadTemplate: () => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const { beginnerMode } = useHelp();

  if (!beginnerMode) return null;

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-100">{t("canvas.quickstart.title")}</div>
        <div className="text-[11px] text-zinc-400">
          {doneCount}/{steps.length}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onLoadTemplate}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500"
        >
          {t("canvas.quickstart.ctaLoadTemplate")}
        </button>
        <button onClick={onClear} className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700">
          {t("canvas.quickstart.ctaClear")}
        </button>
      </div>

      <div className="mt-3 space-y-2 text-[12px]">
        {steps.map((s) => (
          <div
            key={s.id}
            className={clsx(
              "flex items-start gap-2 rounded-lg border px-3 py-2",
              s.done ? "border-emerald-500/40 bg-emerald-500/10 text-zinc-100" : "border-zinc-800 bg-zinc-900/20 text-zinc-300"
            )}
          >
            <div className={clsx("mt-0.5 h-2 w-2 rounded-full", s.done ? "bg-emerald-400" : "bg-zinc-600")} />
            <div className="leading-5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/20 p-3 text-[11px] text-zinc-300">
        <div>
          <span className="text-zinc-400">Aha 1</span>：{t("canvas.quickstart.aha1")}
        </div>
        <div>
          <span className="text-zinc-400">Aha 2</span>：{t("canvas.quickstart.aha2")}（<Term id="portType" />）
        </div>
        <div>
          <span className="text-zinc-400">Aha 3</span>：{t("canvas.quickstart.aha3")}（<Term id="lockedBlocks" /> / <Term id="digest" />）
        </div>
      </div>
    </div>
  );
}

