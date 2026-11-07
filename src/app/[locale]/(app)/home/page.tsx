import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  BellRing,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ClipboardCheck,
  Inbox,
  NotebookPen,
  Repeat,
  Stethoscope,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import ShiftCard from "@/components/ShiftCard";
import { HomeChecklist, InviteCard } from "@/components/HomeClient";
import { buttonClass, Card, EmptyState, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireDoctor } from "@/lib/viewer";
import { SHIFT_WITH_HOSPITAL, type ShiftWithHospital } from "@/lib/shifts";
import { getHospitalTrust } from "@/lib/hospitals";
import type { RotaSlot, Specialty } from "@/lib/constants";
import { dayLabel } from "@/lib/rota";
import { cairoToday, formatDateTime, formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

/** The doctor's start page: what's next, what needs them, and how to get going. */
export default async function HomePage({ params }: PageProps<"/[locale]/home">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireDoctor(locale);
  const t = await getTranslations("Dashboard");
  const o = await getTranslations("Options");
  const n = (x: number) => formatNumber(x, locale);
  const me = viewer.userId;
  const today = cairoToday();
  const nowIso = new Date().toISOString();
  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("group_members")
    .select("group_id, role, supervisor, group:groups!group_members_group_id_fkey(id, name, status)")
    .eq("user_id", me)
    .eq("status", "active");
  const teams = (memberRows ?? []).filter((m) => m.group && m.group.status === "approved");
  const teamIds = teams.map((m) => m.group_id);
  const teamName = new Map(teams.map((m) => [m.group_id, m.group!.name]));
  const superIds = teams.filter((m) => m.supervisor).map((m) => m.group_id);
  const managerIds = teams.filter((m) => m.role === "owner" || m.role === "moderator").map((m) => m.group_id);
  const none = ["00000000-0000-0000-0000-000000000000"];

  const [
    { data: duties },
    { data: bookings },
    { count: handoversForMe },
    { data: handoverTeam },
    { count: swapsAskedMe },
    { data: acceptedSwaps },
    { data: teamSupervisors },
    { count: rotasToApprove },
    { count: logbookToSign },
    { count: jobOffers },
    { count: offersOnMyShifts },
    { count: myShiftsCount },
    { count: myAlerts },
    { data: ownShifts },
  ] = await Promise.all([
    supabase.from("team_duties").select("id, group_id, duty_date, slot").eq("doctor_id", me).gte("duty_date", today).order("duty_date").limit(3),
    supabase
      .from("bookings")
      .select("id, shift:shifts!bookings_shift_id_fkey(start_at, hospital:hospitals!shifts_hospital_id_fkey(name))")
      .eq("doctor_id", me)
      .is("cancelled_at", null)
      .eq("doctor_completed", false)
      .limit(10),
    supabase.from("team_handovers").select("id", { count: "exact", head: true }).eq("to_doctor_id", me).is("received_by", null).is("closed_at", null),
    supabase.from("team_handovers").select("group_id").eq("to_doctor_id", me).is("received_by", null).is("closed_at", null).limit(1),
    supabase.from("rota_swaps").select("id", { count: "exact", head: true }).eq("target_id", me).eq("status", "asked"),
    supabase.from("rota_swaps").select("id, group_id").eq("status", "accepted").in("group_id", teamIds.length ? teamIds : none),
    supabase.from("group_members").select("group_id").eq("supervisor", true).eq("status", "active").in("group_id", teamIds.length ? teamIds : none),
    supabase.from("team_rota_months").select("group_id", { count: "exact", head: true }).eq("status", "pending").in("group_id", superIds.length ? superIds : none),
    supabase.from("logbook_entries").select("id", { count: "exact", head: true }).eq("sign_status", "requested").in("sign_team_id", superIds.length ? superIds : none),
    supabase.from("job_offers").select("id", { count: "exact", head: true }).eq("doctor_id", me).eq("status", "pending"),
    supabase.from("offers").select("id, shift:shifts!inner(poster_id, status)", { count: "exact", head: true }).eq("status", "pending").eq("shift.poster_id", me).eq("shift.status", "open"),
    supabase.from("shifts").select("id", { count: "exact", head: true }).eq("poster_id", me),
    supabase.from("saved_alerts").select("id", { count: "exact", head: true }).eq("user_id", me),
    supabase
      .from("shifts")
      .select(SHIFT_WITH_HOSPITAL)
      .eq("status", "open")
      .is("group_id", null)
      .eq("specialty", viewer.profile.specialty)
      .gte("start_at", nowIso)
      .order("urgent", { ascending: false })
      .order("start_at")
      .limit(3),
  ]);

  // Swaps I approve: supervisors approve; teams without one are approved by managers.
  const supervised = new Set((teamSupervisors ?? []).map((x) => x.group_id));
  const swapsToApprove = (acceptedSwaps ?? []).filter((s) =>
    supervised.has(s.group_id) ? superIds.includes(s.group_id) : managerIds.includes(s.group_id),
  );

  // Latest shifts: my specialty first, other specialties when mine has none.
  let shifts = (ownShifts ?? []) as unknown as ShiftWithHospital[];
  let otherSpecialties = false;
  if (shifts.length === 0) {
    const { data } = await supabase
      .from("shifts")
      .select(SHIFT_WITH_HOSPITAL)
      .eq("status", "open")
      .is("group_id", null)
      .gte("start_at", nowIso)
      .order("urgent", { ascending: false })
      .order("start_at")
      .limit(3);
    shifts = (data ?? []) as unknown as ShiftWithHospital[];
    otherSpecialties = shifts.length > 0;
  }
  const trust = await getHospitalTrust(supabase, shifts.map((s) => s.hospital_id));

  // What's next: rota duties and booked shifts, soonest first.
  type Next = { key: string; when: string; title: string; sub: string; href: string };
  const next: Next[] = [
    ...(duties ?? []).map((d) => ({
      key: d.id,
      when: d.duty_date,
      title: `${o(`rotaSlot.${d.slot as RotaSlot}`)} · ${teamName.get(d.group_id) ?? ""}`,
      sub: d.duty_date === today ? t("today") : `${dayLabel(d.duty_date, locale).weekday} ${dayLabel(d.duty_date, locale).day}`,
      href: `/teams/${d.group_id}/rota?month=${d.duty_date.slice(0, 7)}`,
    })),
    ...(bookings ?? [])
      .filter((b) => b.shift && b.shift.start_at >= nowIso)
      .map((b) => ({
        key: b.id,
        when: b.shift!.start_at.slice(0, 10),
        title: b.shift!.hospital?.name ?? "—",
        sub: formatDateTime(b.shift!.start_at, locale),
        href: `/bookings/${b.id}`,
      })),
  ]
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 4);

  const attention: { key: string; count: number; href: string; Icon: typeof Inbox }[] = [
    { key: "handovers", count: handoversForMe ?? 0, href: handoverTeam?.[0] ? `/teams/${handoverTeam[0].group_id}/handover` : "/teams", Icon: Stethoscope },
    { key: "swapsAsked", count: swapsAskedMe ?? 0, href: teamIds[0] ? `/teams/${teamIds[0]}/rota` : "/teams", Icon: Repeat },
    { key: "swapsApprove", count: swapsToApprove.length, href: swapsToApprove[0] ? `/teams/${swapsToApprove[0].group_id}/rota` : "/teams", Icon: ClipboardCheck },
    { key: "rotaApprove", count: rotasToApprove ?? 0, href: superIds[0] ? `/teams/${superIds[0]}/rota` : "/teams", Icon: CalendarClock },
    { key: "logbookSign", count: logbookToSign ?? 0, href: superIds[0] ? `/teams/${superIds[0]}/logbook` : "/teams", Icon: NotebookPen },
    { key: "jobOffers", count: jobOffers ?? 0, href: "/activity", Icon: Briefcase },
    { key: "shiftOffers", count: offersOnMyShifts ?? 0, href: "/activity", Icon: Inbox },
  ].filter((a) => a.count > 0);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "shiftna.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const inviteUrl = `${proto}://${host}/${locale}/install`;

  const firstName = viewer.profile.full_name?.split(" ").slice(0, 2).join(" ") ?? "";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 12 ? t("morning") : hour < 18 ? t("afternoon") : t("evening");

  const row = (href: string, Icon: typeof Inbox, title: ReactNode, sub?: ReactNode, badge?: ReactNode) => (
    <Link href={href} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-ink">{title}</span>
        {sub ? <span className="truncate text-xs text-ink-muted">{sub}</span> : null}
      </span>
      {badge}
      <ChevronLeft className="h-4 w-4 shrink-0 text-ink-muted ltr:rotate-180" aria-hidden />
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5 pb-1">
        <span className="text-sm text-ink-muted">{greeting}</span>
        <h1 className="text-2xl font-extrabold text-ink">{firstName}</h1>
      </header>

      {attention.length > 0 ? (
        <Card className="flex flex-col">
          <SectionTitle>{t("attentionTitle")}</SectionTitle>
          {attention.map((a) =>
            row(
              a.href,
              a.Icon,
              t(`attention.${a.key as "handovers"}`, { count: a.count, n: n(a.count) }),
              undefined,
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{n(a.count)}</span>,
            ),
          )}
        </Card>
      ) : null}

      {next.length > 0 ? (
        <Card className="flex flex-col">
          <SectionTitle>{t("nextTitle")}</SectionTitle>
          {next.map((x) => <div key={x.key}>{row(x.href, CalendarClock, x.title, x.sub)}</div>)}
        </Card>
      ) : null}

      <HomeChecklist
        steps={[
          { key: "team", href: "/teams", done: teamIds.length > 0 },
          { key: "post", href: "/post", done: (myShiftsCount ?? 0) > 0 },
          { key: "alert", href: "/notifications", done: (myAlerts ?? 0) > 0 },
        ]}
      />

      <section className="flex flex-col gap-2" aria-labelledby="latest-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="latest-title" className="text-lg font-bold">{t("latestTitle")}</h2>
          <Link href={otherSpecialties ? "/shifts?spec=all" : "/shifts"} className="text-sm font-semibold text-brand-700">
            {t("seeAll")}
          </Link>
        </div>
        {otherSpecialties ? (
          <p className="text-xs text-ink-muted">{t("otherSpecialties", { specialty: o(`specialty.${viewer.profile.specialty as Specialty}`) })}</p>
        ) : null}
        {shifts.length === 0 ? (
          <EmptyState
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/post" className={buttonClass.primary}>{t("postFirst")}</Link>
                <Link href="/notifications" className={buttonClass.secondary}>
                  <BellRing className="h-4 w-4" aria-hidden /> {t("setAlert")}
                </Link>
              </div>
            }
          >
            <span className="block font-semibold text-ink">{t("noShiftsTitle")}</span>
            {t("noShiftsBody")}
          </EmptyState>
        ) : (
          shifts.map((s) => (
            <ShiftCard key={s.id} shift={s} mine={s.poster_id === me} trust={trust.get(s.hospital_id)?.level} showSpecialty={otherSpecialties} />
          ))
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="teams-title">
        <h2 id="teams-title" className="text-lg font-bold">{t("teamsTitle")}</h2>
        {teams.length === 0 ? (
          <Card className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-ink-muted">{t("noTeams")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/teams/new" className={buttonClass.primary}>{t("createTeam")}</Link>
              <Link href="/teams" className={buttonClass.secondary}>{t("joinTeam")}</Link>
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col">
            {teams.map((m) => (
              <div key={m.group_id}>
                {row(
                  `/teams/${m.group_id}`,
                  Users,
                  m.group!.name,
                  m.supervisor ? t("youSupervise") : m.role === "owner" ? t("youOwn") : undefined,
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      <InviteCard url={inviteUrl} />
    </div>
  );
}
