import { getTranslations, setRequestLocale } from "next-intl/server";
import { getContactPhones } from "@/lib/contacts";
import { createClient } from "@/lib/supabase/server";
import { Link, redirect } from "@/i18n/navigation";
import AuthShell from "@/components/AuthShell";
import DetailsForm from "@/components/DetailsForm";
import DocUploader from "@/components/DocUploader";
import { buttonClass, Card, SectionTitle } from "@/components/ui";
import { REQUIRED_DOCS } from "@/lib/constants";
import {
  docsToUpload,
  getMyLatestDocs,
  profileComplete,
  requireUser,
} from "@/lib/viewer";
import type { Locale } from "@/i18n/routing";

export default async function OnboardingPage({
  params,
}: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireUser(locale);
  if (viewer.profile.status === "approved") {
    redirect({ href: "/shifts", locale: locale as Locale });
  }

  const t = await getTranslations("Onboarding");
  const docs = await getMyLatestDocs(viewer.userId);
  const ready = profileComplete(viewer.profile) && docsToUpload(docs).length === 0;
  const p = viewer.profile;
  const myPhone = (await getContactPhones(await createClient(), [viewer.userId])).get(viewer.userId) ?? "";

  return (
    <AuthShell>
      <div>
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="pt-1 text-sm text-ink-muted">{t("intro")}</p>
      </div>

      <Card>
        <SectionTitle>{t("step1")}</SectionTitle>
        <DetailsForm
          defaults={{
            fullName: p.full_name ?? "",
            phone: myPhone,
            grade: p.grade ?? "",
            city: p.city ?? "",
          }}
        />
      </Card>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("step2")}</SectionTitle>
        <p className="text-sm leading-relaxed text-ink-muted">{t("docsIntro")}</p>
        {REQUIRED_DOCS.map((type) => (
          <DocUploader
            key={type}
            userId={viewer.userId}
            type={type}
            status={docs[type]?.status ?? "none"}
            rejectReason={docs[type]?.reject_reason}
          />
        ))}
      </section>

      <div className="flex flex-col gap-2 pb-4">
        {ready ? (
          <Link href="/status" className={buttonClass.primary}>
            {t("finish")}
          </Link>
        ) : (
          <>
            <button type="button" disabled className={buttonClass.primary}>
              {t("finish")}
            </button>
            <p className="text-center text-xs text-ink-muted">{t("finishHint")}</p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
