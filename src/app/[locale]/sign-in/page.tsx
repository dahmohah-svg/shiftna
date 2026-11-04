import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import AuthShell from "@/components/AuthShell";
import SignInForm from "@/components/SignInForm";
import { Notice } from "@/components/ui";
import type { Locale } from "@/i18n/routing";

export default async function SignInPage({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { confirm } = await searchParams;
  const t = await getTranslations("Auth");

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold">{t("signInTitle")}</h1>
      {confirm === "failed" ? <Notice tone="danger">{t("confirmFailed")}</Notice> : null}
      <SignInForm />
      <p className="text-center text-sm text-ink-muted">
        {t("noAccount")}{" "}
        <Link href="/sign-up" className="font-semibold text-brand-700 underline">
          {t("signUpButton")}
        </Link>
      </p>
    </AuthShell>
  );
}
