import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Logo from "@/components/Logo";
import { buttonClass } from "@/components/ui";
import { getViewer } from "@/lib/viewer";
import type { Locale } from "@/i18n/routing";

const features = [
  { key: "Verified", icon: "✓" },
  { key: "Clear", icon: "≡" },
  { key: "Ratings", icon: "★" },
] as const;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  // Signed-in doctors skip the welcome page.
  const viewer = await getViewer();
  if (viewer) {
    redirect({
      href: viewer.profile.status === "approved" ? "/shifts" : "/status",
      locale: locale as Locale,
    });
  }

  const t = await getTranslations("Home");
  const c = await getTranslations("Common");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between py-2">
        <Logo size="sm" />
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 flex-col gap-8 pt-10">
        <section className="flex flex-col gap-4">
          <Logo size="lg" />
          <h1 className="text-4xl leading-tight font-extrabold text-ink">
            {c("appName")}
          </h1>
          <p className="text-xl font-semibold text-brand-700">{t("tagline")}</p>
          <p className="text-base leading-relaxed text-ink-muted">{t("intro")}</p>
        </section>

        <div className="flex flex-col gap-3">
          <Link href="/sign-up" className={buttonClass.primary}>
            {t("signUp")}
          </Link>
          <Link href="/sign-in" className={buttonClass.secondary}>
            {t("signIn")}
          </Link>
        </div>

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
      </main>

      <footer className="flex flex-col items-center gap-2 pt-8 text-xs text-ink-muted">
        <p>{t("footer")}</p>
        <p className="flex gap-4">
          <Link href="/privacy" className="underline">{t("privacy")}</Link>
          <Link href="/terms" className="underline">{t("terms")}</Link>
        </p>
      </footer>
    </div>
  );
}
