"use client";

import { BeginnerToggle } from "@/components/BeginnerToggle";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useI18n } from "@/lib/i18n";
import { useHelp } from "@/lib/help";

export function TopNav({ mode }: { mode: "builder" | "admin" }) {
  const { t } = useI18n();
  const { openGlossary } = useHelp();
  const link =
    mode === "builder"
      ? { href: "/admin", label: t("nav.admin") }
      : { href: "/", label: t("nav.backToBuilder") };

  return (
    <div className="flex items-center gap-3">
      <a className="text-xs text-indigo-300 hover:underline" href={link.href}>
        {link.label}
      </a>
      <button
        onClick={() => openGlossary()}
        className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-900/40"
      >
        {t("help.glossary")}
      </button>
      <BeginnerToggle />
      <LanguageSwitch />
    </div>
  );
}

