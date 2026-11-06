import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatNumber } from "@/lib/time";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import ActionButton from "@/components/ActionButton";
import ShiftCard from "@/components/ShiftCard";
import { InviteBox } from "@/components/TeamForms";
import { Badge, buttonClass, Card, EmptyState, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { allowRejoin, decideMember, leaveTeam, readdMember, renewInviteCode } from "@/app/actions/teams";
import { setSupervisor } from "@/app/actions/rota";
import { CalendarDays, NotebookPen, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import { SHIFT_WITH_HOSPITAL, type ShiftWithHospital } from "@/lib/shifts";
import type { City, Grade } from "@/lib/constants";
import { getHospitalTrust } from "@/lib/hospitals";
import { getVerifiedDoctors } from "@/lib/doctors";
import VerifiedBadge from "@/components/VerifiedBadge";
import TeamStatusBadge from "@/components/TeamStatusBadge";
import type { Locale } from "@/i18n/routing";

export default async function TeamPage({ params }: PageProps<"/[locale]/teams/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const t = await getTranslations("Teams");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const rt = await getTranslations("Rota");
  const ht = await getTranslations("Handover");
  const lt = await getTranslations("Logbook");
  const back = (
    <Link href="/teams" className="text-sm font-semibold text-brand-700">
      <span aria-hidden className="inline-block rtl:rotate-180">←</span> {c("back")}
    </Link>
  );

  if (!z.string().uuid().safeParse(id).success) {
    return <div className="flex flex-col gap-4">{back}<EmptyState>{t("notFound")}</EmptyState></div>;
  }

  const supabase = await createClient();
  const [{ data: team }, { data: me }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, institution, description, status, verified, hospital:hospitals!groups_hospital_id_fkey(name, city)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select("role, status, supervisor")
      .eq("group_id", id)
      .eq("user_id", viewer.userId)
      .maybeSingle(),
  ]);

  const active = me?.status === "active";
  if (!team || team.status !== "approved" || !active) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        {team && team.status !== "approved" ? (
          <>
            <PageTitle>{team.name}</PageTitle>
            <Notice tone="warn">{team.status === "suspended" ? t("pausedNotice") : t("notApprovedYet")}</Notice>
          </>
        ) : !team && active ? (
          // Members cannot read a paused team, but their membership is still there.
          <Notice tone="warn">{t("pausedNotice")}</Notice>
        ) : (
          <EmptyState>{t("notFound")}</EmptyState>
        )}
      </div>
    );
  }

  const manager = me!.role === "owner" || me!.role === "moderator";

  const [{ data: members }, { data: requests }, { data: invite }, { data: shiftRows }, { data: former }] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id, role, supervisor, profile:profiles!group_members_user_id_fkey(full_name, grade, city)")
      .eq("group_id", id)
      .eq("status", "active"),
    manager
      ? supabase
          .from("group_members")
          .select("user_id, requested_at, profile:profiles!group_members_user_id_fkey(full_name, grade, city)")
          .eq("group_id", id)
          .eq("status", "pending")
          .order("requested_at", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    manager
      ? supabase.from("group_invites").select("code").eq("group_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("shifts")
      .select(SHIFT_WITH_HOSPITAL)
      .eq("group_id", id)
      .eq("status", "open")
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(30),
    manager
      ? supabase
          .from("group_members")
          .select("user_id, decided_by, decided_at, profile:profiles!group_members_user_id_fkey(full_name, grade, city)")
          .eq("group_id", id)
          .eq("status", "removed")
          .eq("role", "member")
          .order("decided_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const { count: logbookPending } = me!.supervisor
    ? await supabase
        .from("logbook_entries")
        .select("id", { count: "exact", head: true })
        .eq("sign_team_id", id)
        .eq("sign_status", "requested")
    : { count: 0 };
  const shifts = (shiftRows ?? []) as unknown as ShiftWithHospital[];
  const [trust, verified] = await Promise.all([
    getHospitalTrust(supabase, shifts.map((s) => s.hospital_id)),
    getVerifiedDoctors(supabase, [...(members ?? []), ...(requests ?? [])].map((m) => m.user_id)),
  ]);
  const roleOrder: Record<string, number> = { owner: 0, moderator: 1, member: 2 };
  const sortedMembers = [...(members ?? [])].sort(
    (a, b) =>
      roleOrder[a.role] - roleOrder[b.role] ||
      (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? ""),
  );
  const doctorLine = (p: { grade: string | null; city: string | null } | null) =>
    [p?.grade ? o(`grade.${p.grade as Grade}`) : null, p?.city ? o(`city.${p.city as City}`) : null]
      .filter(Boolean)
      .join(" · ");

  let inviteLink = "";
  if (invite?.code) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "https";
    inviteLink = `${proto}://${host}/${locale}/teams?code=${invite.code}`;
  }

  return (
    <div className="flex flex-col gap-5">
      {back}
      <div>
        <PageTitle action={<TeamStatusBadge verified={team.verified} />}>{team.name}</PageTitle>
        <p className="-mt-3 text-sm text-ink-muted">
          {team.institution}
          {team.hospital ? ` · ${team.hospital.name}` : null}
        </p>
        {team.description ? <p className="pt-2 text-sm leading-relaxed">{team.description}</p> : null}
      </div>

      <Link
        href={`/teams/${id}/rota`}
        className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4"
      >
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-700">
          <CalendarDays className="h-6 w-6" strokeWidth={2.25} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-bold text-ink">{rt("title")}</span>
          <span className="text-sm text-ink-muted">{rt("teamLink")}</span>
        </span>
        <span aria-hidden className="ms-auto text-xl text-brand-700 rtl:rotate-180">›</span>
      </Link>

      <Link
        href={`/teams/${id}/handover`}
        className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4"
      >
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Stethoscope className="h-6 w-6" strokeWidth={2.25} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-bold text-ink">{ht("title")}</span>
          <span className="text-sm text-ink-muted">{ht("teamLink")}</span>
        </span>
        <span aria-hidden className="ms-auto text-xl text-brand-700 rtl:rotate-180">›</span>
      </Link>

      {me!.supervisor ? (
        <Link
          href={`/teams/${id}/logbook`}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4"
        >
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <NotebookPen className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-bold text-ink">{lt("teamTitle")}</span>
            <span className="text-sm text-ink-muted">{lt("teamLink")}</span>
          </span>
          {(logbookPending ?? 0) > 0 ? <Badge tone="warn">{formatNumber(logbookPending!, locale)}</Badge> : null}
          <span aria-hidden className="ms-auto text-xl text-brand-700 rtl:rotate-180">›</span>
        </Link>
      ) : null}

      {manager && (requests ?? []).length > 0 ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("requests", { count: requests!.length, n: formatNumber(requests!.length, locale) })}</SectionTitle>
          {requests!.map((r) => (
            <div key={r.user_id} className="flex flex-col gap-2 rounded-xl bg-page p-3">
              <span className="flex items-center gap-1.5">
                <Link href={`/doctors/${r.user_id}`} className="font-semibold underline">
                  {r.profile?.full_name ?? c("dash")}
                </Link>
                {verified.has(r.user_id) ? <VerifiedBadge compact /> : null}
              </span>
              <span className="text-sm text-ink-muted">{doctorLine(r.profile)}</span>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton action={decideMember} fields={{ teamId: id, userId: r.user_id, accept: "1" }}>
                  {t("accept")}
                </ActionButton>
                <ActionButton action={decideMember} fields={{ teamId: id, userId: r.user_id, accept: "0" }} variant="secondary">
                  {t("decline")}
                </ActionButton>
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>{t("teamShifts")}</SectionTitle>
          <Link href={`/post?team=${id}`} className={`${buttonClass.secondary} min-h-9 py-1.5 text-sm`}>
            {t("postToTeam")}
          </Link>
        </div>
        {shifts.length === 0 ? <EmptyState>{t("noTeamShifts")}</EmptyState> : null}
        {shifts.map((s) => (
          <ShiftCard key={s.id} shift={s} mine={s.poster_id === viewer.userId} trust={trust.get(s.hospital_id)?.level} />
        ))}
      </section>

      {manager && invite?.code ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("inviteTitle")}</SectionTitle>
          <InviteBox code={invite.code} link={inviteLink} />
          <ActionButton action={renewInviteCode} fields={{ teamId: id }} variant="ghost" confirm={t("renewConfirm")}>
            {t("renewCode")}
          </ActionButton>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2">
        <SectionTitle>{t("members", { count: sortedMembers.length, n: formatNumber(sortedMembers.length, locale) })}</SectionTitle>
        <ul className="flex flex-col">
          {sortedMembers.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Link href={`/doctors/${m.user_id}`} className="truncate font-semibold">
                    {m.profile?.full_name ?? c("dash")}
                    {m.user_id === viewer.userId ? ` (${c("you")})` : null}
                  </Link>
                  {verified.has(m.user_id) ? <VerifiedBadge compact /> : null}
                </span>
                <span className="text-xs text-ink-muted">{doctorLine(m.profile)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {m.role !== "member" ? <Badge tone="brand">{t(`role.${m.role as "owner" | "moderator"}`)}</Badge> : null}
                {m.supervisor ? <Badge tone="success">{rt("supervisor")}</Badge> : null}
                {me!.role === "owner" ? (
                  <ActionButton
                    action={setSupervisor}
                    fields={{ teamId: id, userId: m.user_id, on: m.supervisor ? "0" : "1" }}
                    variant="ghost"
                  >
                    {m.supervisor ? rt("removeSupervisor") : rt("makeSupervisor")}
                  </ActionButton>
                ) : null}
                {manager && m.role === "member" ? (
                  <ActionButton
                    action={decideMember}
                    fields={{ teamId: id, userId: m.user_id, accept: "0" }}
                    variant="ghost"
                    confirm={t("removeConfirm", { name: m.profile?.full_name ?? "" })}
                  >
                    {t("remove")}
                  </ActionButton>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {manager && (former ?? []).length > 0 ? (
        <Card className="flex flex-col gap-2">
          <SectionTitle>{t("formerTitle")}</SectionTitle>
          <p className="text-sm text-ink-muted">{t("formerIntro")}</p>
          <ul className="flex flex-col">
            {former!.map((m) => {
              const left = m.decided_by === m.user_id;
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{m.profile?.full_name ?? c("dash")}</span>
                    <span className="text-xs text-ink-muted">{left ? t("leftThemselves") : t("removedByManager")}</span>
                  </span>
                  {left ? (
                    <ActionButton action={allowRejoin} fields={{ teamId: id, userId: m.user_id }} variant="secondary" success={t("rejoinAllowed")}>
                      {t("allowRejoin")}
                    </ActionButton>
                  ) : (
                    <ActionButton
                      action={readdMember}
                      fields={{ teamId: id, userId: m.user_id }}
                      variant="secondary"
                      confirm={t("readdConfirm", { name: m.profile?.full_name ?? "" })}
                    >
                      {t("readd")}
                    </ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {me!.role === "member" ? (
        <ActionButton action={leaveTeam} fields={{ teamId: id }} variant="danger" confirm={t("leaveConfirm")}>
          {t("leave")}
        </ActionButton>
      ) : null}
    </div>
  );
}
