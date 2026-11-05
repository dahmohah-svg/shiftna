import { Building2, ClipboardList, ShieldCheck, Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import InstallApp from "@/components/InstallApp";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import WelcomePreview from "@/components/WelcomePreview";
import Logo from "@/components/Logo";
import { buttonClass } from "@/components/ui";
import { getViewer, homePath } from "@/lib/viewer";
import type { Locale } from "@/i18n/routing";

const features = [
  { key: "Verified", Icon: ShieldCheck },
  { key: "Clear", Icon: ClipboardList },
  { key: "Ratings", Icon: Star },
] as const;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  // Signed-in doctors skip the welcome page.
  const viewer = await getViewer();
  if (viewer) {
    redirect({
      href: viewer.profile.status === "approved" ? homePath(viewer.profile) : "/status",
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
          <InstallApp variant="button" />
        </div>

        <WelcomePreview />

        <ul className="flex flex-col gap-3">
          {features.map(({ key, Icon }) => (
            <li
              key={key}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
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

        {/* Hospital HR join too: they find doctors and post their hospital's shifts. */}
        <section className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-700">
              <Building2 className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 className="font-bold text-ink">{t("hrTitle")}</h2>
              <p className="text-sm leading-relaxed text-ink-muted">{t("hrBody")}</p>
            </div>
          </div>
          <Link href="/sign-up" className={buttonClass.secondary}>{t("hrCta")}</Link>
        </section>
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
