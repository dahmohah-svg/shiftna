import { getTranslations, setRequestLocale } from "next-intl/server";
import PushToggle from "@/components/PushToggle";
import AvatarUpload from "@/components/AvatarUpload";
import { getContactPhones } from "@/lib/contacts";
import ActionButton from "@/components/ActionButton";
import { setShowPhone } from "@/app/actions/profile";
import { Link } from "@/i18n/navigation";
import DetailsForm from "@/components/DetailsForm";
import JobOffersSetting from "@/components/JobOffersSetting";
import InstallApp from "@/components/InstallApp";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import StatsGrid from "@/components/StatsGrid";
import TrustBadge from "@/components/TrustBadge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { ScanFace } from "lucide-react";
import { Badge, buttonClass, Card, DetailRow, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyLatestDocs, isHr, requireApproved } from "@/lib/viewer";
import { getMyHospital } from "@/lib/jobs";
import { requiredDocsFor, EVERYTHING_FREE, type Specialty } from "@/lib/constants";
import { formatDate } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const { profile } = viewer;
  const t = await getTranslations("Profile");
  const tm = await getTranslations("Teams");
  const o = await getTranslations("Options");
  const d = await getTranslations("Docs");
  const ob = await getTranslations("Onboarding");
  const c = await getTranslations("Common");
  const supabase = await createClient();
  const myPhone = (await getContactPhones(supabase, [viewer.userId])).get(viewer.userId) ?? "";

  const hr = isHr(profile);
  const j = await getTranslations("Jobs");
  const hrT = await getTranslations("Hr");

  const [{ data: stats }, { data: trust }, docs, hospital] = await Promise.all([
    hr ? Promise.resolve({ data: null }) : supabase.rpc("doctor_stats", { p_doctor: viewer.userId }),
    hr ? Promise.resolve({ data: null }) : supabase.rpc("doctor_trust", { p_doctor: viewer.userId }),
    getMyLatestDocs(viewer.userId),
    hr ? getMyHospital(supabase, viewer.userId) : Promise.resolve(null),
  ]);
  const tr = trust?.[0];

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("title")}</PageTitle>

      {hr ? (
        <Card className="flex flex-col gap-3">
          <AvatarUpload userId={viewer.userId} name={profile.full_name ?? ""} url={profile.photo_url} />
          <div className="flex min-w-0 flex-col">
            <span className="text-xl font-extrabold">{profile.full_name}</span>
            <span className="text-sm text-ink-muted">{profile.job_title}</span>
            <span className="text-sm font-semibold text-ink">{hospital?.name ?? hrT("noHospitalShort")}</span>
            <span className="pt-1"><Badge tone="brand">{j("hrBadge")}</Badge></span>
          </div>
        </Card>
      ) : (
      <Card className="flex flex-col gap-2">
        <AvatarUpload userId={viewer.userId} name={profile.full_name ?? ""} url={profile.photo_url} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xl font-extrabold">{profile.full_name}</span>
            <span className="text-sm text-ink-muted">
              {o(`specialty.${profile.specialty as Specialty}`)}
              {profile.grade ? ` · ${o(`grade.${profile.grade as "resident"}`)}` : null}
              {profile.city ? ` · ${o(`city.${profile.city as "cairo"}`)}` : null}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TrustBadge badge={tr?.badge} />
            {!EVERYTHING_FREE && profile.is_premium ? <Badge tone="gold">{t("premium")}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
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
      )}

      {!hr ? (
        <Card>
          <JobOffersSetting open={profile.open_to_offers} note={profile.offer_note ?? ""} />
        </Card>
      ) : null}

      {!hr ? (
        <Link
          href="/logbook"
          className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
        >
          <span className="flex flex-col">
            <span className="font-bold">{(await getTranslations("Logbook"))("title")}</span>
            <span className="text-sm text-ink-muted">{(await getTranslations("Logbook"))("profileLink")}</span>
          </span>
          <span aria-hidden className="text-xl text-brand-700 rtl:rotate-180">›</span>
        </Link>
      ) : null}

      {!hr ? (
      <Link
        href="/teams"
        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
      >
        <span className="flex flex-col">
          <span className="font-bold">{tm("title")}</span>
          <span className="text-sm text-ink-muted">{tm("profileLink")}</span>
        </span>
        <span aria-hidden className="text-xl text-brand-700 rtl:rotate-180">›</span>
      </Link>
      ) : null}

      {!hr ? (
        <Card>
          <SectionTitle>{t("stats")}</SectionTitle>
          <StatsGrid stats={stats?.[0] ?? null} showRankRow />
        </Card>
      ) : null}

      <Card>
        <SectionTitle>{t("documents")}</SectionTitle>
        <dl>
          {requiredDocsFor(profile.grade, profile.account_type).map((k) => {
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

      {/* Hidden while everything is free during the pilot. */}
      {!EVERYTHING_FREE ? (
        <Card className="flex flex-col gap-2">
          <SectionTitle>{t("premium")}</SectionTitle>
          {profile.is_premium ? <Notice tone="success">{t("premiumActive")}</Notice> : null}
          <p className="text-sm leading-relaxed text-ink-muted">{t("premiumBody")}</p>
        </Card>
      ) : null}

      <Card>
        <details>
          <summary className="cursor-pointer text-lg font-bold">{t("edit")}</summary>
          <div className="pt-3">
            <DetailsForm
              locked={profile.status === "approved"}
              defaults={{
                fullName: profile.full_name ?? "",
                phone: myPhone,
                grade: profile.grade ?? "",
                specialty: profile.specialty ?? "",
                city: profile.city ?? "",
                accountType: profile.account_type,
                jobTitle: profile.job_title ?? "",
                hrHospital: profile.hr_hospital_name ?? "",
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
        <div className="border-t border-line pt-3">
          <PushToggle />
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{t("showPhone")}</span>
              <span className="text-xs text-ink-muted">
                {profile.show_phone ? t("showPhoneOn") : t("showPhoneOff")}
              </span>
            </div>
            <ActionButton
              action={setShowPhone}
              fields={{ show: profile.show_phone ? "0" : "1" }}
              variant={profile.show_phone ? "secondary" : "primary"}
              className="shrink-0"
            >
              {profile.show_phone ? t("hidePhone") : t("sharePhone")}
            </ActionButton>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{(await getTranslations("Theme"))("label")}</span>
          <ThemeSwitcher />
        </div>
        <InstallApp variant="button" />
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
