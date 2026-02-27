"use client";

import { useI18n } from "@/lib/i18n";

export function BuilderHeader() {
  const { t } = useI18n();
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <div className="text-xs font-medium text-zinc-400">{t("builder.badge")}</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{t("builder.title")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">{t("builder.subtitle")}</p>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-xs text-zinc-400">
        <div className="font-mono">{t("builder.endpoints.web")}</div>
        <div className="font-mono">{t("builder.endpoints.api")}</div>
      </div>
    </div>
  );
}

export function AdminHeader() {
  const { t } = useI18n();
  return (
    <div>
      <div className="text-xs font-medium text-zinc-400">{t("admin.badge")}</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{t("admin.title")}</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">{t("admin.subtitle")}</p>
    </div>
  );
}

