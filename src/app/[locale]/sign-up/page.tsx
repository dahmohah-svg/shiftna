import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import AuthShell from "@/components/AuthShell";
import SignUpForm from "@/components/SignUpForm";
import type { Locale } from "@/i18n/routing";

export default async function SignUpPage({ params }: PageProps<"/[locale]/sign-up">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Auth");

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold">{t("signUpTitle")}</h1>
      <p className="text-sm leading-relaxed text-ink-muted">{t("signUpIntro")}</p>
      <SignUpForm />
      <p className="text-center text-sm text-ink-muted">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className="font-semibold text-brand-700 underline">
          {t("signInButton")}
        </Link>
      </p>
    </AuthShell>
  );
}
