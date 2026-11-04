"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export default function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={other}
      aria-label={t("label")}
      className="rounded-full border border-brand-200 px-4 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
    >
      {t("switchTo")}
    </Link>
  );
}
