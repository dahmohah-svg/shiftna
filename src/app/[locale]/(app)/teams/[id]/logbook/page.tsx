import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import LogbookEntryCard from "@/components/LogbookEntryCard";
import { SignEntriesForm } from "@/components/LogbookForms";
import { Card, EmptyState, PageTitle, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import { LOGBOOK_COLUMNS, logbookNames, type LogbookEntry } from "@/lib/logbook";
import type { Grade } from "@/lib/constants";
import { formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

/** Supervisor: logbook entries the team's doctors sent for sign-off. */
export default async function TeamLogbookPage({ params }: PageProps<"/[locale]/teams/[id]/logbook">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const t = await getTranslations("Logbook");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const back = (
    <Link href={`/teams/${id}`} className="text-sm font-semibold text-brand-700">
      <span aria-hidden className="inline-block rtl:rotate-180">←</span> {c("back")}
    </Link>
  );
  if (!z.string().uuid().safeParse(id).success) return <div className="flex flex-col gap-4">{back}<EmptyState>{t("notSupervisor")}</EmptyState></div>;
  const supabase = await createClient();
  const [{ data: team }, { data: me }] = await Promise.all([
    supabase.from("groups").select("name").eq("id", id).maybeSingle(),
    supabase.from("group_members").select("status, supervisor").eq("group_id", id).eq("user_id", viewer.userId).maybeSingle(),
  ]);
  if (!team || me?.status !== "active" || !me.supervisor) {
    return <div className="flex flex-col gap-4">{back}<EmptyState>{t("notSupervisor")}</EmptyState></div>;
  }

  const [{ data: pendingRows }, { data: signedRows }] = await Promise.all([
    supabase.from("logbook_entries").select(LOGBOOK_COLUMNS).eq("sign_team_id", id).eq("sign_status", "requested").order("entry_date").limit(300),
    supabase
      .from("logbook_entries")
      .select(LOGBOOK_COLUMNS)
      .eq("sign_team_id", id)
      .eq("sign_status", "signed")
      .eq("signed_by", viewer.userId)
      .order("signed_at", { ascending: false })
      .limit(20),
  ]);
  const pending = (pendingRows ?? []) as unknown as LogbookEntry[];
  const signed = (signedRows ?? []) as unknown as LogbookEntry[];
  const names = await logbookNames(supabase, [...pending, ...signed]);
  const byDoctor = new Map<string, LogbookEntry[]>();
  for (const e of pending) byDoctor.set(e.user_id, [...(byDoctor.get(e.user_id) ?? []), e]);

  return (
    <div className="flex flex-col gap-4">
      {back}
      <div>
        <PageTitle>{t("teamTitle")}</PageTitle>
        <p className="-mt-3 text-sm text-ink-muted">{team.name}</p>
      </div>
      {pending.length === 0 ? (
        <EmptyState>{t("nothingToSign")}</EmptyState>
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <p className="text-sm text-ink-muted">{t("signIntro", { n: formatNumber(pending.length, locale) })}</p>
            <SignEntriesForm />
          </Card>
          {[...byDoctor.entries()].map(([doc, list]) => {
            const p = names.person.get(doc);
            return (
              <section key={doc} className="flex flex-col gap-2">
                <SectionTitle>
                  {p?.full_name ?? "—"}
                  {p?.grade ? <span className="text-sm font-semibold text-ink-muted"> · {o(`grade.${p.grade as Grade}`)}</span> : null}
                </SectionTitle>
                {list.map((e) => (
                  <LogbookEntryCard key={e.id} e={e} selectForm="signoff-sign" teamName={team.name} />
                ))}
              </section>
            );
          })}
        </>
      )}
      {signed.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>{t("recentlySigned")}</SectionTitle>
          {signed.map((e) => (
            <div key={e.id} className="flex flex-col gap-1">
              <span className="px-1 text-xs font-semibold text-ink-muted">{names.person.get(e.user_id)?.full_name ?? "—"}</span>
              <LogbookEntryCard e={e} signerName={names.person.get(viewer.userId)?.full_name} />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
