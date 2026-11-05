import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import AuthShell from "@/components/AuthShell";
import { buttonClass, Card, Notice } from "@/components/ui";
import { signOut } from "@/app/actions/auth";
import { requiredDocsFor } from "@/lib/constants";
import {
  docsToUpload,
  getMyLatestDocs,
  homePath,
  profileComplete,
  requireUser,
} from "@/lib/viewer";
import type { Locale } from "@/i18n/routing";

export default async function StatusPage({ params }: PageProps<"/[locale]/status">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireUser(locale);
  const { profile } = viewer;
  if (profile.status === "approved") {
    redirect({ href: homePath(profile), locale: locale as Locale });
  }

  const t = await getTranslations("Status");
  const d = await getTranslations("Docs");
  const c = await getTranslations("Common");
  const docs = await getMyLatestDocs(viewer.userId);
  const missing = docsToUpload(docs, profile);
  const rejected = requiredDocsFor(profile.grade, profile.account_type).filter((k) => docs[k]?.status === "rejected");

  let body;
  if (profile.status === "suspended") {
    const expired = profile.suspended_reason === "document_expired";
    body = (
      <Card className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold">{t("suspendedTitle")}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          {expired ? t("suspendedExpired") : t("suspendedBody")}
        </p>
        {expired ? (
          <Link href="/onboarding" className={buttonClass.primary}>{t("fixDocs")}</Link>
        ) : null}
      </Card>
    );
  } else if (rejected.length > 0) {
    body = (
      <Card className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold">{t("rejectedTitle")}</h1>
        <p className="text-sm text-ink-muted">{t("rejectedBody")}</p>
        <ul className="flex flex-col gap-2">
          {rejected.map((k) => (
            <li key={k}>
              <Notice tone="danger">
                <strong>{d(k)}</strong>
                {docs[k]?.reject_reason ? `: ${docs[k]!.reject_reason}` : null}
              </Notice>
            </li>
          ))}
        </ul>
        <Link href="/onboarding" className={buttonClass.primary}>{t("fixDocs")}</Link>
      </Card>
    );
  } else if (!profileComplete(profile) || missing.length > 0) {
    body = (
      <Card className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold">{t("incompleteTitle")}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{t("incompleteBody")}</p>
        <Link href="/onboarding" className={buttonClass.primary}>{t("continue")}</Link>
      </Card>
    );
  } else {
    body = (
      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl">⏳</span>
        <h1 className="text-2xl font-extrabold">{t("pendingTitle")}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{t("pendingBody")}</p>
        <Link href="/status" className={buttonClass.secondary}>{t("refresh")}</Link>
      </Card>
    );
  }

  return (
    <AuthShell>
      {body}
      <form action={signOut} className="flex justify-center">
        <button type="submit" className={buttonClass.ghost}>{c("signOut")}</button>
      </form>
    </AuthShell>
  );
}
