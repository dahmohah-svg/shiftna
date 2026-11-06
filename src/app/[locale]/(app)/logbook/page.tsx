import { getTranslations, setRequestLocale } from "next-intl/server";
import { Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import LogbookEntryCard from "@/components/LogbookEntryCard";
import { AddLogbookEntryForm, RequestSignoffForm } from "@/components/LogbookForms";
import { buttonClass, Card, EmptyState, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireDoctor } from "@/lib/viewer";
import { subspecialtiesFor } from "@/lib/constants";
import { LOGBOOK_COLUMNS, logbookNames, type LogbookEntry } from "@/lib/logbook";
import { cairoToday, formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

/** The doctor's training logbook, with supervisor sign-off. */
export default async function LogbookPage({ params }: PageProps<"/[locale]/logbook">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireDoctor(locale);
  const t = await getTranslations("Logbook");
  const n = (x: number) => formatNumber(x, locale);
  const supabase = await createClient();

  const [{ data: rows }, { data: memberships }] = await Promise.all([
    supabase
      .from("logbook_entries")
      .select(LOGBOOK_COLUMNS)
      .eq("user_id", viewer.userId)
      .order("entry_date", { ascending: false })
      .limit(500),
    supabase
      .from("group_members")
      .select("group_id, group:groups!group_members_group_id_fkey(id, name, status)")
      .eq("user_id", viewer.userId)
      .eq("status", "active"),
  ]);
  const entries = (rows ?? []) as unknown as LogbookEntry[];
  const names = await logbookNames(supabase, entries);
  const teams = (memberships ?? [])
    .map((m) => m.group)
    .filter((g): g is NonNullable<typeof g> => Boolean(g && g.status === "approved"))
    .map((g) => ({ id: g.id, name: g.name }));

  const toSend = entries.filter((e) => !e.verified && (e.sign_status === "none" || e.sign_status === "returned"));
  const others = entries.filter((e) => !toSend.includes(e));
  const signed = entries.filter((e) => e.verified || e.sign_status === "signed");
  const totalCases = entries.reduce((s, e) => s + (e.cases_count ?? 0), 0);
  const totalHours = entries.reduce((s, e) => s + (e.hours ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        action={
          entries.length > 0 ? (
            <Link href="/logbook/print" className={`${buttonClass.ghost} min-h-9 text-sm`}>
              <Printer className="h-4 w-4" aria-hidden /> {t("print")}
            </Link>
          ) : undefined
        }
      >
        {t("title")}
      </PageTitle>
      <p className="-mt-3 text-sm text-ink-muted">{t("intro")}</p>

      <div className="grid grid-cols-3 gap-2">
        {[
          [t("statEntries"), n(entries.length)],
          [t("statSigned"), n(signed.length)],
          [t("statCases"), n(totalCases)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-3 text-center">
            <p className="text-xs text-ink-muted">{k}</p>
            <p className="text-xl font-extrabold">{v}</p>
          </div>
        ))}
      </div>
      {totalHours > 0 ? <p className="text-xs text-ink-muted">{t("statHours", { n: n(totalHours) })}</p> : null}

      <Card>
        <details open={entries.length === 0}>
          <summary className="cursor-pointer text-lg font-bold">{t("new")}</summary>
          <div className="pt-3">
            <AddLogbookEntryForm today={cairoToday()} subspecialties={subspecialtiesFor(viewer.profile.specialty)} />
          </div>
        </details>
      </Card>

      {toSend.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>{t("toSign")}</SectionTitle>
          {teams.length === 0 ? <Notice>{t("noTeams")}</Notice> : <RequestSignoffForm teams={teams} />}
          {toSend.map((e) => (
            <LogbookEntryCard key={e.id} e={e} selectForm={teams.length ? "signoff-request" : undefined} canDelete />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionTitle>{t("history")}</SectionTitle>
        {others.length === 0 ? <EmptyState>{entries.length === 0 ? t("empty") : t("noHistory")}</EmptyState> : null}
        {others.map((e) => (
          <LogbookEntryCard
            key={e.id}
            e={e}
            signerName={e.signed_by ? names.person.get(e.signed_by)?.full_name : undefined}
            teamName={e.sign_team_id ? names.team.get(e.sign_team_id) : undefined}
            canDelete
          />
        ))}
      </section>
    </div>
  );
}
