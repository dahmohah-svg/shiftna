import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import PrintButton from "@/components/PrintButton";
import { EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import { ROTA_SLOTS } from "@/lib/constants";
import { dayLabel, daysOf, monthEnd, monthLabel, monthStart, parseMonth } from "@/lib/rota";
import { formatDateTime } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

/** A printable month of the team rota, for the department notice board. */
export default async function RotaPrintPage({ params, searchParams }: PageProps<"/[locale]/teams/[id]/rota/print">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requireApproved(locale);
  const sp = await searchParams;
  const month = parseMonth(sp.month);
  const t = await getTranslations("Rota");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const supabase = await createClient();

  const [{ data: team }, { data: monthRow }, { data: duties }, { data: memberRows }] = await Promise.all([
    supabase.from("groups").select("name, institution").eq("id", id).maybeSingle(),
    supabase.from("team_rota_months").select("status, approved_by, approved_at").eq("group_id", id).eq("month", monthStart(month)).maybeSingle(),
    supabase
      .from("team_duties")
      .select("duty_date, slot, doctor_id")
      .eq("group_id", id)
      .gte("duty_date", monthStart(month))
      .lte("duty_date", monthEnd(month)),
    supabase
      .from("group_members")
      .select("user_id, profile:profiles!group_members_user_id_fkey(full_name)")
      .eq("group_id", id)
      .eq("status", "active"),
  ]);
  if (!team) return <EmptyState>{t("notFound")}</EmptyState>;
  const name = new Map((memberRows ?? []).map((m) => [m.user_id, m.profile?.full_name ?? "—"]));
  const cell = (date: string, slot: string) =>
    (duties ?? []).filter((d) => d.duty_date === date && d.slot === slot).map((d) => name.get(d.doctor_id) ?? "—").join("، ");
  const usedSlots = ROTA_SLOTS.filter((s) => (duties ?? []).some((d) => d.slot === s));

  return (
    <div className="flex flex-col gap-4 print:gap-2">
      <div className="no-print flex items-center justify-between gap-2">
        <Link href={`/teams/${id}/rota?month=${month}`} className="text-sm font-semibold text-brand-700">
          <span aria-hidden className="inline-block rtl:rotate-180">←</span> {c("back")}
        </Link>
        <PrintButton label={t("printNow")} />
      </div>
      <header className="flex flex-col">
        <h1 className="text-2xl font-extrabold">{team.name} · {monthLabel(month, locale)}</h1>
        <p className="text-sm text-ink-muted">
          {team.institution}
          {monthRow?.status === "published" && monthRow.approved_by
            ? ` · ${t("approvedBy", { name: name.get(monthRow.approved_by) ?? "—", when: formatDateTime(monthRow.approved_at!, locale) })}`
            : monthRow?.status !== "published" ? ` · ${t("statusDraft")}` : null}
        </p>
      </header>
      {usedSlots.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <table className="w-full border-collapse text-xs print:text-[10px]">
          <thead>
            <tr>
              <th className="border border-line bg-page p-1.5 text-start">{t("day")}</th>
              {usedSlots.map((s) => (
                <th key={s} className="border border-line bg-page p-1.5 text-start">{o(`rotaSlot.${s}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daysOf(month).map((date) => {
              const { weekday, day } = dayLabel(date, locale);
              return (
                <tr key={date} className="break-inside-avoid">
                  <td className="border border-line p-1.5 font-semibold whitespace-nowrap">{weekday} {day}</td>
                  {usedSlots.map((s) => (
                    <td key={s} className="border border-line p-1.5">{cell(date, s)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="text-[10px] text-ink-muted">{t("printFooter")}</p>
    </div>
  );
}
