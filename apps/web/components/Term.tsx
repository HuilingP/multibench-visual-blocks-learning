"use client";

import clsx from "clsx";

import { useHelp, type GlossaryEntryId } from "@/lib/help";
import { useI18n } from "@/lib/i18n";

export function Term({
  id,
  className,
  children
}: {
  id: GlossaryEntryId;
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { openGlossary } = useHelp();

  const label = children ?? t(`glossary.entries.${id}.term`);
  const oneLiner = t(`glossary.entries.${id}.oneLiner`);

  return (
    <button
      type="button"
      onClick={() => openGlossary(id)}
      title={oneLiner}
      className={clsx(
        "inline-flex items-center gap-1 rounded px-1 text-indigo-300 underline decoration-dotted underline-offset-4 hover:bg-indigo-500/10",
        className
      )}
    >
      {label}
    </button>
  );
}

