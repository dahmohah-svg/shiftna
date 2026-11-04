import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { Locale } from "@/i18n/routing";

const features = [
  { key: "Verified", icon: "✓" },
  { key: "Clear", icon: "≡" },
  { key: "Ratings", icon: "★" },
] as const;

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations("Home");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between py-2">
        <span className="text-xl font-bold text-brand-700">{t("appName")}</span>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 flex-col gap-8 pt-10">
        <section className="flex flex-col gap-4">
          <div
            aria-hidden
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl font-bold text-white shadow-lg shadow-brand-600/30"
          >
            {locale === "ar" ? "ش" : "S"}
          </div>
          <h1 className="text-4xl leading-tight font-extrabold text-ink">
            {t("appName")}
          </h1>
          <p className="text-xl font-semibold text-brand-700">{t("tagline")}</p>
          <p className="text-base leading-relaxed text-ink-muted">{t("intro")}</p>
        </section>

        <ul className="flex flex-col gap-3">
          {features.map(({ key, icon }) => (
            <li
              key={key}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700"
              >
                {icon}
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 className="font-bold text-ink">{t(`feature${key}Title`)}</h2>
                <p className="text-sm leading-relaxed text-ink-muted">
                  {t(`feature${key}Body`)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-center text-sm font-medium text-brand-800">
          {t("comingSoon")}
        </p>
      </main>

      <footer className="pt-8 text-center text-xs text-ink-muted">
        {t("footer")}
      </footer>
    </div>
  );
}
