import { getTranslations, setRequestLocale } from "next-intl/server";
import PostShiftForm from "@/components/PostShiftForm";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import type { Locale } from "@/i18n/routing";

export default async function PostPage({ params }: PageProps<"/[locale]/post">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireApproved(locale);
  const t = await getTranslations("Post");
  const o = await getTranslations("Options");

  const supabase = await createClient();
  const { data: hospitals } = await supabase
    .from("hospitals")
    .select("id, name, city")
    .eq("verified", true)
    .order("name");

  // Earliest allowed start, as a Cairo local time for the date picker.
  const minStart = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace(" ", "T");

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      {hospitals && hospitals.length > 0 ? (
        <Card>
          <PostShiftForm
            minStart={minStart}
            hospitals={hospitals.map((h) => ({
              id: h.id,
              name: h.name,
              cityLabel: o(`city.${h.city as "cairo"}`),
            }))}
          />
        </Card>
      ) : (
        <EmptyState>{t("noHospitals")}</EmptyState>
      )}
    </>
  );
}
