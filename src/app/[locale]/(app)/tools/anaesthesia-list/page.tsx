import { getTranslations, setRequestLocale } from "next-intl/server";
import AnaesthesiaListTool from "@/components/AnaesthesiaListTool";
import { Notice, PageTitle } from "@/components/ui";
import { requireApproved } from "@/lib/viewer";
import type { Locale } from "@/i18n/routing";

export default async function AnaesthesiaListPage({ params }: PageProps<"/[locale]/tools/anaesthesia-list">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const t = await getTranslations("AnaesthesiaList");

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("title")}</PageTitle>
      <p className="text-sm text-ink-muted">{t("intro")}</p>
      <Notice tone="warn">{t("disclaimer")}</Notice>
      <AnaesthesiaListTool userId={viewer.userId} />
    </div>
  );
}
