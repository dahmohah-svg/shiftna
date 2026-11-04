import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import DetailsForm from "@/components/DetailsForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import StatsGrid from "@/components/StatsGrid";
import TrustBadge from "@/components/TrustBadge";
import { Badge, buttonClass, Card, DetailRow, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyLatestDocs, requireApproved } from "@/lib/viewer";
import { REQUIRED_DOCS } from "@/lib/constants";
import { formatDate } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const { profile } = viewer;
  const t = await getTranslations("Profile");
  const o = await getTranslations("Options");
  const d = await getTranslations("Docs");
  const ob = await getTranslations("Onboarding");
  const c = await getTranslations("Common");
  const supabase = await createClient();

  const [{ data: stats }, { data: trust }, docs] = await Promise.all([
    supabase.rpc("doctor_stats", { p_doctor: viewer.userId }),
    supabase.rpc("doctor_trust", { p_doctor: viewer.userId }),
    getMyLatestDocs(viewer.userId),
  ]);
  const tr = trust?.[0];

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("title")}</PageTitle>

      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xl font-extrabold">{profile.full_name}</span>
            <span className="text-sm text-ink-muted">
              {profile.grade ? o(`grade.${profile.grade as "resident"}`) : null}
              {profile.city ? ` · ${o(`city.${profile.city as "cairo"}`)}` : null}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TrustBadge badge={tr?.badge} />
            {profile.is_premium ? <Badge tone="gold">{t("premium")}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tr?.docs_verified ? <Badge tone="success">✓ {t("docsVerified")}</Badge> : null}
          {tr?.selfie_verified ? <Badge tone="success">✓ {t("selfieVerified")}</Badge> : null}
        </div>
        <details className="text-sm text-ink-muted">
          <summary className="cursor-pointer font-semibold text-brand-700">{t("badge")}</summary>
          <p className="pt-1">{t("badgeExplain")}</p>
        </details>
      </Card>

      <Card>
        <SectionTitle>{t("stats")}</SectionTitle>
        <StatsGrid stats={stats?.[0] ?? null} showRankRow />
      </Card>

      <Card>
        <SectionTitle>{t("documents")}</SectionTitle>
        <dl>
          {REQUIRED_DOCS.map((k) => {
            const doc = docs[k];
            return (
              <DetailRow key={k} label={d(k)}>
                {doc?.status === "approved" ? (
                  <span className="flex flex-col items-end">
                    <Badge tone="success">{ob("approved")}</Badge>
                    {doc.expires_on ? (
                      <span className="pt-1 text-xs font-normal text-ink-muted">
                        {t("expires", { date: formatDate(doc.expires_on, locale) })}
                      </span>
                    ) : null}
                  </span>
                ) : doc ? (
                  <Badge tone="brand">{ob("uploaded")}</Badge>
                ) : (
                  <Badge>{ob("notUploaded")}</Badge>
                )}
              </DetailRow>
            );
          })}
        </dl>
      </Card>

      <Card className="flex flex-col gap-2">
        <SectionTitle>{t("premium")}</SectionTitle>
        {profile.is_premium ? <Notice tone="success">{t("premiumActive")}</Notice> : null}
        <p className="text-sm leading-relaxed text-ink-muted">{t("premiumBody")}</p>
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-lg font-bold">{t("edit")}</summary>
          <div className="pt-3">
            <DetailsForm
              defaults={{
                fullName: profile.full_name ?? "",
                phone: profile.phone ?? "",
                grade: profile.grade ?? "",
                city: profile.city ?? "",
              }}
            />
          </div>
        </details>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t("settings")}</SectionTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("language")}</span>
          <LanguageSwitcher />
        </div>
        {profile.is_admin ? (
          <Link href="/admin" className={buttonClass.secondary}>{t("adminPanel")}</Link>
        ) : null}
        <div className="flex gap-4 text-sm">
          <Link href="/privacy" className="text-brand-700 underline">{(await getTranslations("Home"))("privacy")}</Link>
          <Link href="/terms" className="text-brand-700 underline">{(await getTranslations("Home"))("terms")}</Link>
        </div>
        <form action={signOut}>
          <button type="submit" className={`${buttonClass.danger} w-full`}>{c("signOut")}</button>
        </form>
      </Card>
    </div>
  );
}
