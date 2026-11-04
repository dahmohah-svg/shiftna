import { getTranslations, setRequestLocale } from "next-intl/server";
import AuthShell from "@/components/AuthShell";
import { Notice } from "@/components/ui";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Legal");
  const items = t.raw("termsBody") as string[];

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold">{t("termsTitle")}</h1>
      <Notice tone="warn">{t("draft")}</Notice>
      <ol className="flex list-decimal flex-col gap-3 ps-5 text-sm leading-relaxed text-ink">
        {items.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </AuthShell>
  );
}
