import { getTranslations, setRequestLocale } from "next-intl/server";
import AddHospitalInline from "@/components/AddHospitalInline";
import PostShiftForm from "@/components/PostShiftForm";
import { Card, Notice, PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { isHr, requireApproved } from "@/lib/viewer";
import { getMyHospital } from "@/lib/jobs";
import type { Locale } from "@/i18n/routing";

export default async function PostPage({ params, searchParams }: PageProps<"/[locale]/post">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const sp = await searchParams;
  const t = await getTranslations("Post");
  const o = await getTranslations("Options");

  const supabase = await createClient();
  const hr = isHr(viewer.profile);
  // Hospital HR post only for their own hospital.
  const mine = hr ? await getMyHospital(supabase, viewer.userId) : null;
  const { data: allHospitals } = hr
    ? { data: mine ? [{ ...mine, verified: true }] : [] }
    : await supabase.from("hospitals").select("id, name, city, verified").order("name");
  const hospitals = allHospitals;

  const { data: memberships } = hr
    ? { data: [] }
    : await supabase
        .from("group_members")
        .select("group:groups!group_members_group_id_fkey(id, name, status)")
        .eq("user_id", viewer.userId)
        .eq("status", "active");
  const teams = (memberships ?? [])
    .map((m) => m.group)
    .filter((g): g is NonNullable<typeof g> => Boolean(g && g.status === "approved"))
    .map((g) => ({ id: g.id, name: g.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const defaultTeam = teams.some((g) => g.id === sp.team) ? (sp.team as string) : "";
  const h = await getTranslations("Hospitals");
  const defaultHospital = hr && mine ? mine.id : (hospitals ?? []).some((x) => x.id === sp.hospital) ? (sp.hospital as string) : "";

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
      <div className="flex flex-col gap-4">
        {defaultHospital && !hr ? <Notice tone="success">{sp.existing === "1" ? h("existing") : h("added")}</Notice> : null}
        {hospitals && hospitals.length > 0 ? (
          <Card>
            <PostShiftForm
              minStart={minStart}
              teams={teams}
              defaultTeam={defaultTeam}
              defaultHospital={defaultHospital}
              defaultSpecialty={viewer.profile.specialty}
              hospitals={hospitals.map((x) => ({
                id: x.id,
                name: x.name,
                cityLabel: o(`city.${x.city as "cairo"}`) + (x.verified ? "" : ` (${h("notVerified")})`),
              }))}
            />
          </Card>
        ) : (
          <Notice>{t("noHospitals")}</Notice>
        )}
        {!hr ? <AddHospitalInline defaultCity={viewer.profile.city ?? undefined} open={!hospitals || hospitals.length === 0} /> : null}
      </div>
    </>
  );
}
