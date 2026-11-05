import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CreateTeamForm } from "@/components/TeamForms";
import { Card, Notice, PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import { EVERYTHING_FREE, type City } from "@/lib/constants";
import type { Locale } from "@/i18n/routing";

export default async function NewTeamPage({ params }: PageProps<"/[locale]/teams/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const t = await getTranslations("Teams");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");

  const supabase = await createClient();
  const { data: hospitals } = await supabase
    .from("hospitals")
    .select("id, name, city")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/teams" className="text-sm font-semibold text-brand-700">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {c("back")}
      </Link>
      <PageTitle>{t("createTitle")}</PageTitle>
      {EVERYTHING_FREE || viewer.profile.is_premium ? (
        <Card>
          <CreateTeamForm
            userId={viewer.userId}
            hospitals={(hospitals ?? []).map((h) => ({
              id: h.id,
              label: `${h.name} · ${o(`city.${h.city as City}`)}`,
            }))}
          />
        </Card>
      ) : (
        <Notice>{t("createNeedsPremium")}</Notice>
      )}
    </div>
  );
}
