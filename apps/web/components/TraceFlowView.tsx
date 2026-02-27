"use client";

import clsx from "clsx";

import { useI18n } from "@/lib/i18n";
import type { ExplainStep } from "@/types/pipeline";

export function TraceFlowView({
  steps,
  activeNodeId,
  onPick
}: {
  steps: ExplainStep[];
  activeNodeId?: string | null;
  onPick: (nodeId: string) => void;
}) {
  const { t } = useI18n();
  if (!steps.length) return null;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-stretch gap-2">
        {steps.map((s, idx) => {
          const active = s.nodeId === activeNodeId;
          return (
            <div key={`${s.nodeId}-${idx}`} className="flex items-center gap-2">
              <button
                onClick={() => onPick(s.nodeId)}
                className={clsx(
                  "w-[220px] rounded-lg border p-2 text-left transition",
                  active
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900/60"
                )}
              >
                <div className="text-[11px] text-zinc-400">{s.nodeType}</div>
                <div className="mt-1 text-xs font-semibold text-zinc-100">{s.title}</div>
                <div className="mt-1 truncate font-mono text-[10px] text-zinc-500">
                  {s.blockId}@{s.version}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-400">
                  <span>{t("canvas.inputsShort")}: {s.inputs.length}</span>
                  <span>{t("canvas.outputsShort")}: {s.outputs.length}</span>
                </div>
              </button>
              {idx < steps.length - 1 ? <div className="text-zinc-500">→</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

