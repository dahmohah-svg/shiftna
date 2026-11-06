import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { AlertTriangle, ChevronLeft, ChevronRight, Printer, Repeat } from "lucide-react";
import { Link } from "@/i18n/navigation";
import ActionButton from "@/components/ActionButton";
import { AddDutiesForm, RemoveDutyButton, ReturnRotaForm } from "@/components/RotaForms";
import { Badge, buttonClass, Card, EmptyState, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { answerSwap, cancelSwap, decideRota, decideSwap, submitRota } from "@/app/actions/rota";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import { ROTA_SLOTS, WEEKLY_HOURS_WARNING, type RotaSlot } from "@/lib/constants";
import { dayLabel, daysOf, hoursByDoctor, monthEnd, monthLabel, monthStart, parseMonth, shiftMonth, type Duty } from "@/lib/rota";
import { cairoToday, formatDate, formatDateTime, formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

const SLOT_TONE: Record<RotaSlot, string> = {
  day: "border-amber-200 bg-amber-50 text-amber-900",
  night: "border-indigo-200 bg-indigo-50 text-indigo-900",
  full: "border-brand-200 bg-brand-50 text-brand-800",
  on_call: "border-line bg-page text-ink",
};

export default async function RotaPage({ params, searchParams }: PageProps<"/[locale]/teams/[id]/rota">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const sp = await searchParams;
  const month = parseMonth(sp.month);
  const t = await getTranslations("Rota");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const n = (x: number) => formatNumber(x, locale);

  const back = (
    <Link href={`/teams/${id}`} className="text-sm font-semibold text-brand-700">
      <span aria-hidden className="inline-block rtl:rotate-180">←</span> {c("back")}
    </Link>
  );
  if (!z.string().uuid().safeParse(id).success) return <div className="flex flex-col gap-4">{back}<EmptyState>{t("notFound")}</EmptyState></div>;

  const supabase = await createClient();
  const [{ data: team }, { data: me }, { data: memberRows }] = await Promise.all([
    supabase.from("groups").select("id, name, status").eq("id", id).maybeSingle(),
    supabase.from("group_members").select("role, status, supervisor").eq("group_id", id).eq("user_id", viewer.userId).maybeSingle(),
    supabase
      .from("group_members")
      .select("user_id, role, supervisor, profile:profiles!group_members_user_id_fkey(full_name)")
      .eq("group_id", id)
      .eq("status", "active"),
  ]);
  if (!team || team.status !== "approved" || me?.status !== "active") {
    return <div className="flex flex-col gap-4">{back}<EmptyState>{t("notFound")}</EmptyState></div>;
  }

  const manager = me.role === "owner" || me.role === "moderator";
  const supervisor = me.supervisor;
  const editor = manager || supervisor;
  const members = (memberRows ?? [])
    .map((m) => ({ id: m.user_id, name: m.profile?.full_name ?? "—", supervisor: m.supervisor, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const name = new Map(members.map((m) => [m.id, m.name]));
  const hasSupervisor = members.some((m) => m.supervisor);
  const swapApprover = hasSupervisor ? supervisor : manager;

  const first = monthStart(month);
  const last = monthEnd(month);
  const [{ data: monthRow }, { data: dutyRows }, { data: swapRows }, { data: logRows }] = await Promise.all([
    supabase.from("team_rota_months").select("*").eq("group_id", id).eq("month", first).maybeSingle(),
    supabase
      .from("team_duties")
      .select("id, duty_date, slot, doctor_id, note")
      .eq("group_id", id)
      .gte("duty_date", first)
      .lte("duty_date", last)
      .order("duty_date"),
    supabase
      .from("rota_swaps")
      .select(
        "id, status, note, requester_id, target_id, created_at, " +
          "mine:team_duties!rota_swaps_requester_duty_id_fkey(duty_date, slot), " +
          "theirs:team_duties!rota_swaps_target_duty_id_fkey(duty_date, slot)",
      )
      .eq("group_id", id)
      .in("status", ["asked", "accepted"])
      .order("created_at", { ascending: false })
      .limit(50),
    editor
      ? supabase.from("team_rota_log").select("*").eq("group_id", id).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const status = (monthRow?.status ?? "draft") as "draft" | "pending" | "published";
  const duties = (dutyRows ?? []) as Duty[];
  type Swap = {
    id: string;
    status: string;
    note: string | null;
    requester_id: string;
    target_id: string;
    mine: { duty_date: string; slot: RotaSlot } | null;
    theirs: { duty_date: string; slot: RotaSlot } | null;
  };
  const swaps = (swapRows ?? []) as unknown as Swap[];
  const toApprove = swapApprover ? swaps.filter((s) => s.status === "accepted") : [];
  const askedMe = swaps.filter((s) => s.status === "asked" && s.target_id === viewer.userId);
  const myRequests = swaps.filter((s) => s.requester_id === viewer.userId);
  const swapping = new Set(myRequests.map((s) => s.mine && `${s.mine.duty_date}|${s.mine.slot}`));

  const today = cairoToday();
  const byDay = new Map<string, Duty[]>();
  for (const d of duties) byDay.set(d.duty_date, [...(byDay.get(d.duty_date) ?? []), d]);
  const hours = hoursByDoctor(duties, WEEKLY_HOURS_WARNING);
  const mine = hours.get(viewer.userId);
  const slotLabel = (s: RotaSlot) => o(`rotaSlot.${s}`);
  const dutyText = (d: { duty_date: string; slot: RotaSlot } | null) =>
    d ? `${dayLabel(d.duty_date, locale).weekday} ${formatDate(d.duty_date, locale)} · ${slotLabel(d.slot)}` : c("dash");
  // Weekday names for the fill form, 0 = Sunday (5 Jan 2025 was a Sunday).
  const weekdayNames = Array.from({ length: 7 }, (_, i) => dayLabel(`2025-01-${String(5 + i).padStart(2, "0")}`, locale).weekday);

  const statusBadge =
    status === "published" ? <Badge tone="success">{t("statusPublished")}</Badge> : status === "pending" ? <Badge tone="warn">{t("statusPending")}</Badge> : <Badge>{t("statusDraft")}</Badge>;

  const swapLine = (s: Swap) =>
    s.theirs
      ? t("swapLine", { a: name.get(s.requester_id) ?? "—", b: name.get(s.target_id) ?? "—", mine: dutyText(s.mine), theirs: dutyText(s.theirs) })
      : t("coverLine", { a: name.get(s.requester_id) ?? "—", b: name.get(s.target_id) ?? "—", mine: dutyText(s.mine) });

  return (
    <div className="flex flex-col gap-4">
      {back}
      <div>
        <PageTitle action={statusBadge}>{t("title")}</PageTitle>
        <p className="-mt-3 text-sm text-ink-muted">{team.name}</p>
      </div>

      <nav className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-2" aria-label={t("month")}>
        <Link href={`/teams/${id}/rota?month=${shiftMonth(month, -1)}`} className={`${buttonClass.ghost} min-h-10`} aria-label={t("prevMonth")}>
          {locale === "ar" ? <ChevronRight className="h-5 w-5" aria-hidden /> : <ChevronLeft className="h-5 w-5" aria-hidden />}
        </Link>
        <span className="font-bold">{monthLabel(month, locale)}</span>
        <Link href={`/teams/${id}/rota?month=${shiftMonth(month, 1)}`} className={`${buttonClass.ghost} min-h-10`} aria-label={t("nextMonth")}>
          {locale === "ar" ? <ChevronLeft className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
        </Link>
      </nav>

      {/* Status and publishing. */}
      {editor ? (
        <Card className="flex flex-col gap-3">
          {status === "published" && monthRow?.approved_by ? (
            <p className="text-sm text-ink-muted">
              {t("approvedBy", { name: name.get(monthRow.approved_by) ?? "—", when: formatDateTime(monthRow.approved_at!, locale) })}
            </p>
          ) : null}
          {status === "draft" && monthRow?.return_note ? <Notice tone="warn">{t("returnedNote", { note: monthRow.return_note })}</Notice> : null}
          {status === "pending" ? (
            <p className="text-sm text-ink-muted">{t("pendingNote", { name: name.get(monthRow?.submitted_by ?? "") ?? "—" })}</p>
          ) : null}
          {status === "pending" && supervisor ? (
            <div className="flex flex-col gap-3">
              <ActionButton action={decideRota} fields={{ teamId: id, month, approve: "1" }}>{t("approve")}</ActionButton>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-red-700">{t("returnRota")}</summary>
                <div className="pt-2"><ReturnRotaForm teamId={id} month={month} /></div>
              </details>
            </div>
          ) : null}
          {status === "draft" ? (
            <ActionButton action={submitRota} fields={{ teamId: id, month }} confirm={supervisor || !hasSupervisor ? t("publishConfirm") : undefined}>
              {supervisor || !hasSupervisor ? t("publish") : t("sendForApproval")}
            </ActionButton>
          ) : null}
          <p className="text-xs text-ink-muted">{status === "published" ? t("publishedEditNote") : hasSupervisor ? t("supervisorFlowNote") : t("noSupervisorNote")}</p>
        </Card>
      ) : status !== "published" ? (
        <Notice>{t("notPublished")}</Notice>
      ) : null}

      {toApprove.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("swapsToApprove")}</SectionTitle>
          {toApprove.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-xl bg-page p-3">
              <p className="text-sm">{swapLine(s)}</p>
              {s.note ? <p className="text-xs text-ink-muted">“{s.note}”</p> : null}
              <div className="grid grid-cols-2 gap-2">
                <ActionButton action={decideSwap} fields={{ id: s.id, yes: "1" }}>{t("approveSwap")}</ActionButton>
                <ActionButton action={decideSwap} fields={{ id: s.id, yes: "0" }} variant="secondary">{t("rejectSwap")}</ActionButton>
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {askedMe.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("askedYou")}</SectionTitle>
          {askedMe.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-xl bg-page p-3">
              <p className="text-sm">{swapLine(s)}</p>
              {s.note ? <p className="text-xs text-ink-muted">“{s.note}”</p> : null}
              <div className="grid grid-cols-2 gap-2">
                <ActionButton action={answerSwap} fields={{ id: s.id, yes: "1" }}>{t("agree")}</ActionButton>
                <ActionButton action={answerSwap} fields={{ id: s.id, yes: "0" }} variant="secondary">{t("decline")}</ActionButton>
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {myRequests.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("myRequests")}</SectionTitle>
          {myRequests.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-page p-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm">{swapLine(s)}</p>
                <Badge tone="warn">{s.status === "asked" ? t("waitingColleague") : t("waitingApproval")}</Badge>
              </div>
              <ActionButton action={cancelSwap} fields={{ id: s.id }} variant="ghost">{t("cancelSwap")}</ActionButton>
            </div>
          ))}
        </Card>
      ) : null}

      {mine ? (
        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          {t("myMonth", { duties: n(mine.duties), hours: n(mine.hours) })}
        </p>
      ) : null}

      {editor ? (
        <Card>
          <details open={duties.length === 0}>
            <summary className="cursor-pointer text-lg font-bold">{t("addTitle")}</summary>
            <div className="pt-3">
              <AddDutiesForm teamId={id} month={month} members={members} first={first} last={last} weekdayNames={weekdayNames} />
            </div>
          </details>
        </Card>
      ) : null}

      {editor || status === "published" ? (
        <section className="flex flex-col gap-2" aria-label={t("title")}>
          <div className="flex items-center justify-between">
            <SectionTitle>{monthLabel(month, locale)}</SectionTitle>
            <Link href={`/teams/${id}/rota/print?month=${month}`} className={`${buttonClass.ghost} min-h-9 text-sm`}>
              <Printer className="h-4 w-4" aria-hidden /> {t("print")}
            </Link>
          </div>
          {duties.length === 0 ? <EmptyState>{t("empty")}</EmptyState> : null}
          <ul className="flex flex-col gap-2">
            {daysOf(month).map((date) => {
              const list = byDay.get(date) ?? [];
              if (list.length === 0 && !editor) return null;
              const { weekday, day } = dayLabel(date, locale);
              const past = date < today;
              return (
                <li
                  key={date}
                  className={`flex gap-3 rounded-2xl border p-3 ${date === today ? "border-brand-400 bg-brand-50/50" : "border-line bg-surface"} ${past ? "opacity-60" : ""}`}
                >
                  <div className="flex w-16 shrink-0 flex-col items-center justify-center text-center">
                    <span className="text-xs font-semibold text-ink-muted">{weekday}</span>
                    <span className="text-sm font-bold whitespace-nowrap">{day}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {list.length === 0 ? <span className="text-sm text-ink-muted">—</span> : null}
                    {ROTA_SLOTS.flatMap((slot) =>
                      list
                        .filter((d) => d.slot === slot)
                        .map((d) => {
                          const isMe = d.doctor_id === viewer.userId;
                          const canSwap = isMe && status === "published" && !past && !swapping.has(`${d.duty_date}|${d.slot}`);
                          return (
                            <span
                              key={d.id}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${SLOT_TONE[slot]} ${isMe ? "ring-2 ring-brand-500" : ""}`}
                            >
                              <span className="opacity-70">{slotLabel(slot)}</span>
                              <span>{name.get(d.doctor_id) ?? "—"}</span>
                              {canSwap ? (
                                <Link href={`/teams/${id}/rota/swap?duty=${d.id}&month=${month}`} className="ms-0.5 inline-flex items-center gap-0.5 text-brand-700 underline">
                                  <Repeat className="h-3 w-3" aria-hidden />
                                  {t("swap")}
                                </Link>
                              ) : null}
                              {editor ? <RemoveDutyButton id={d.id} label={t("removeDuty", { name: name.get(d.doctor_id) ?? "", slot: slotLabel(slot) })} /> : null}
                            </span>
                          );
                        }),
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {editor && hours.size > 0 ? (
        <Card className="flex flex-col gap-2">
          <SectionTitle>{t("hoursTitle")}</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs text-ink-muted">
                <th className="py-1 text-start font-semibold">{t("doctor")}</th>
                <th className="w-20 px-1 py-1 text-center font-semibold">{t("duties")}</th>
                <th className="w-16 px-1 py-1 text-center font-semibold">{t("hours")}</th>
              </tr>
            </thead>
            <tbody>
              {[...hours.entries()]
                .sort((a, b) => b[1].hours - a[1].hours)
                .map(([doc, h]) => (
                  <tr key={doc} className="border-t border-line">
                    <td className="py-2">
                      <span className="font-semibold">{name.get(doc) ?? "—"}</span>
                      {h.heavyWeeks.length > 0 ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                          {t("heavyWeek", { limit: n(WEEKLY_HOURS_WARNING), week: formatDate(h.heavyWeeks[0], locale) })}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 text-center">{n(h.duties)}</td>
                    <td className="py-2 text-center font-semibold">{n(h.hours)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="text-xs text-ink-muted">{t("hoursNote")}</p>
        </Card>
      ) : null}

      {editor && (logRows ?? []).length > 0 ? (
        <Card>
          <details>
            <summary className="cursor-pointer text-lg font-bold">{t("historyTitle")}</summary>
            <ul className="flex flex-col pt-2">
              {logRows!.map((l) => (
                <li key={l.id} className="border-b border-line py-2 text-sm last:border-b-0">
                  <span>
                    {t(`log.${l.action as "added"}`, {
                      actor: name.get(l.actor_id ?? "") ?? "—",
                      doctor: name.get(l.doctor_id ?? "") ?? "—",
                      other: name.get(l.other_doctor_id ?? "") ?? "—",
                      when: l.duty_date ? (l.slot ? dutyText({ duty_date: l.duty_date, slot: l.slot as RotaSlot }) : monthLabel(l.duty_date.slice(0, 7), locale)) : "—",
                    })}
                  </span>
                  {l.detail && l.action === "returned" ? <span className="block text-xs text-ink-muted">“{l.detail}”</span> : null}
                  <span className="block text-xs text-ink-muted">{formatDateTime(l.created_at, locale)}</span>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
