import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { GlossaryDrawer } from "@/components/GlossaryDrawer";
import { I18nProvider } from "@/lib/i18n";
import { HelpProvider } from "@/lib/help";

export const metadata = {
  title: "MultiBench Visual Builder (MVP)",
  description: "Drag-and-drop multimodal learning pipelines and run toy experiments."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = cookies().get("mb_locale")?.value ?? "zh-CN";
  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>
          <HelpProvider>
            <GlossaryDrawer />
            {children}
          </HelpProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

