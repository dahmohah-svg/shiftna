import { getTranslations, setRequestLocale } from "next-intl/server";
import StatsGrid from "@/components/StatsGrid";
import TrustBadge from "@/components/TrustBadge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { ScanFace } from "lucide-react";
import { Badge, Card, EmptyState, PageTitle, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import type { Locale } from "@/i18n/routing";

export default async function DoctorPage({ params }: PageProps<"/[locale]/doctors/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requireApproved(locale);
  const t = await getTranslations("Profile");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const supabase = await createClient();

  const { data: doctor } = await supabase
    .from("profiles")
    .select("id, full_name, grade, city")
    .eq("id", id)
    .maybeSingle();
  if (!doctor) return <EmptyState>{c("none")}</EmptyState>;

  const [{ data: stats }, { data: trust }, { data: ratings }] = await Promise.all([
    supabase.rpc("doctor_stats", { p_doctor: id }),
    supabase.rpc("doctor_trust", { p_doctor: id }),
    supabase
      .from("ratings")
      .select("id, score_1, score_2, score_3, comment, created_at")
      .eq("to_user", id)
      .eq("visible", true)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const tr = trust?.[0];
  const b = await getTranslations("Booking");

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("doctorTitle")}</PageTitle>
      <Card className="flex flex-col gap-2">
        <span className="text-xl font-extrabold">{doctor.full_name}</span>
        <span className="text-sm text-ink-muted">
          {doctor.grade ? o(`grade.${doctor.grade as "resident"}`) : null}
          {doctor.city ? ` · ${o(`city.${doctor.city as "cairo"}`)}` : null}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <TrustBadge badge={tr?.badge} />
          {tr?.docs_verified ? <VerifiedBadge /> : null}
          {tr?.selfie_verified ? (
            <Badge tone="success">
              <ScanFace className="h-3.5 w-3.5" aria-hidden /> {t("selfieVerified")}
            </Badge>
          ) : null}
        </div>
        <details className="text-sm text-ink-muted">
          <summary className="cursor-pointer font-semibold text-brand-700">{t("badge")}</summary>
          <p className="pt-1">{t("badgeExplain")}</p>
        </details>
      </Card>

      <Card className="flex flex-col gap-2">
        <SectionTitle>{t("stats")}</SectionTitle>
        <StatsGrid stats={stats?.[0] ?? null} />
        {stats?.[0]?.rank_percentile == null ? (
          <p className="text-xs text-ink-muted">{t("rankPremium")}</p>
        ) : null}
      </Card>


      <Card className="flex flex-col gap-2">
        <SectionTitle>{t("ratingsReceived")}</SectionTitle>
        {(ratings ?? []).length === 0 ? (
          <p className="text-sm text-ink-muted">{t("noRatings")}</p>
        ) : (
          (ratings ?? []).map((r) => (
            <div key={r.id} className="rounded-xl bg-page p-3 text-sm">
              <p>
                {b("skill")}: {r.score_1}★ · {b("reliability")}: {r.score_2}★ · {b("punctuality")}: {r.score_3}★
              </p>
              {r.comment ? <p className="pt-1 text-ink-muted">{r.comment}</p> : null}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
