"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

import { useHelp, GLOSSARY_ORDER, type GlossaryEntryId } from "@/lib/help";
import { useI18n } from "@/lib/i18n";

type Entry = {
  id: GlossaryEntryId;
  term: string;
  oneLiner: string;
  details: string;
  example: string;
  pitfall: string;
};

function keyFor(id: GlossaryEntryId, field: string) {
  return `glossary.entries.${id}.${field}`;
}

export function GlossaryDrawer() {
  const { t } = useI18n();
  const { glossaryOpen, closeGlossary, activeGlossaryId, setActiveGlossaryId } = useHelp();
  const [q, setQ] = useState("");

  const all = useMemo<Entry[]>(
    () =>
      GLOSSARY_ORDER.map((id) => ({
        id,
        term: t(keyFor(id, "term")),
        oneLiner: t(keyFor(id, "oneLiner")),
        details: t(keyFor(id, "details")),
        example: t(keyFor(id, "example")),
        pitfall: t(keyFor(id, "pitfall"))
      })),
    [t]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return all;
    return all.filter((e) => {
      const hay = `${e.term}\n${e.oneLiner}\n${e.details}\n${e.example}\n${e.pitfall}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [all, q]);

  const active = useMemo(() => all.find((e) => e.id === activeGlossaryId) ?? all[0], [activeGlossaryId, all]);

  if (!glossaryOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/50" onClick={closeGlossary} aria-label={t("help.close")} />
      <aside className="absolute right-0 top-0 h-full w-[860px] max-w-[92vw] border-l border-zinc-800 bg-zinc-950 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 p-4">
          <div>
            <div className="text-sm font-semibold text-zinc-100">{t("glossary.title")}</div>
            <div className="mt-1 text-xs text-zinc-400">{t("glossary.subtitle")}</div>
          </div>
          <button
            onClick={closeGlossary}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700"
          >
            {t("help.close")}
          </button>
        </div>

        <div className="grid h-[calc(100%-64px)] grid-cols-[320px_1fr]">
          <div className="border-r border-zinc-800 p-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("help.search")}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none"
            />
            <div className="mt-3 space-y-2 overflow-auto pr-1">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setActiveGlossaryId(e.id)}
                  className={clsx(
                    "block w-full rounded-lg border p-3 text-left",
                    activeGlossaryId === e.id
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50"
                  )}
                >
                  <div className="text-xs font-semibold text-zinc-100">{e.term}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-zinc-400">{e.oneLiner}</div>
                </button>
              ))}
              {filtered.length === 0 ? <div className="text-xs text-zinc-500">{t("glossary.sections.empty")}</div> : null}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xl font-semibold text-zinc-100">{active.term}</div>
            <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 text-sm text-zinc-200">
              {active.oneLiner}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="text-xs font-semibold text-zinc-100">{t("glossary.sections.details")}</div>
                <div className="mt-2 whitespace-pre-wrap text-zinc-300">{active.details}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="text-xs font-semibold text-zinc-100">{t("glossary.sections.example")}</div>
                <div className="mt-2 whitespace-pre-wrap font-mono text-[12px] text-zinc-200">{active.example}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="text-xs font-semibold text-zinc-100">{t("glossary.sections.pitfall")}</div>
                <div className="mt-2 whitespace-pre-wrap text-zinc-300">{active.pitfall}</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

