import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { BedDouble, CheckCheck, ClipboardList } from "lucide-react";
import { Link } from "@/i18n/navigation";
import ActionButton from "@/components/ActionButton";
import { HandoverCommentForm, NewHandoverForm } from "@/components/HandoverForms";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { closeHandover, receiveHandover } from "@/app/actions/handover";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import type { HandoverCondition } from "@/lib/constants";
import { cairoToday, formatDateTime, formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

const CONDITION_TONE = { stable: "success", watch: "warn", critical: "danger" } as const;
const CONDITION_BAR = { stable: "bg-emerald-500", watch: "bg-amber-500", critical: "bg-red-600" } as const;

export default async function HandoverPage({ params, searchParams }: PageProps<"/[locale]/teams/[id]/handover">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const sp = await searchParams;
  const showClosed = sp.view === "closed";
  const t = await getTranslations("Handover");
  const c = await getTranslations("Common");
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
      .select("user_id, profile:profiles!group_members_user_id_fkey(full_name)")
      .eq("group_id", id)
      .eq("status", "active"),
  ]);
  if (!team || team.status !== "approved" || me?.status !== "active") {
    return <div className="flex flex-col gap-4">{back}<EmptyState>{t("notFound")}</EmptyState></div>;
  }
  const editor = me.role === "owner" || me.role === "moderator" || me.supervisor;
  const name = new Map((memberRows ?? []).map((m) => [m.user_id, m.profile?.full_name ?? "—"]));
  const colleagues = (memberRows ?? [])
    .filter((m) => m.user_id !== viewer.userId)
    .map((m) => ({ id: m.user_id, name: m.profile?.full_name ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Default receiver: the colleague on the next duty in the rota (tonight's
  // night duty before 8 pm, otherwise tomorrow's day duty).
  const today = cairoToday();
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const { data: next } = await supabase
    .from("team_duties")
    .select("duty_date, slot, doctor_id")
    .eq("group_id", id)
    .in("duty_date", [today, tomorrow])
    .neq("doctor_id", viewer.userId);
  const pick = (date: string, slots: string[]) => next?.find((d) => d.duty_date === date && slots.includes(d.slot))?.doctor_id;
  const defaultTo = hour < 20 ? (pick(today, ["night", "full"]) ?? pick(tomorrow, ["day", "full"])) : (pick(tomorrow, ["day", "full"]) ?? pick(tomorrow, ["night"]));

  let query = supabase
    .from("team_handovers")
    .select("*, comments:handover_comments(id, author_id, body, created_at)")
    .eq("group_id", id)
    .order("created_at", { ascending: false })
    .limit(showClosed ? 50 : 100);
  query = showClosed ? query.not("closed_at", "is", null) : query.is("closed_at", null);
  const { data: rows } = await query;
  type Row = NonNullable<typeof rows>[number];
  const handovers = (rows ?? []) as Row[];
  const order = { critical: 0, watch: 1, stable: 2 } as Record<string, number>;
  if (!showClosed) handovers.sort((a, b) => order[a.condition] - order[b.condition] || b.created_at.localeCompare(a.created_at));
  const forMe = handovers.filter((h) => h.to_doctor_id === viewer.userId && !h.received_by).length;

  return (
    <div className="flex flex-col gap-4">
      {back}
      <div>
        <PageTitle>{t("title")}</PageTitle>
        <p className="-mt-3 text-sm text-ink-muted">{team.name}</p>
      </div>

      {forMe > 0 ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {t("forYou", { count: forMe, n: formatNumber(forMe, locale) })}
        </p>
      ) : null}

      <Card>
        <details open={handovers.length === 0 && !showClosed}>
          <summary className="cursor-pointer text-lg font-bold">{t("new")}</summary>
          <div className="pt-3">
            <NewHandoverForm teamId={id} colleagues={colleagues} defaultTo={defaultTo} />
          </div>
        </details>
      </Card>

      <nav className="flex gap-2" aria-label={t("title")}>
        {[
          { key: "open", href: `/teams/${id}/handover`, label: t("open") },
          { key: "closed", href: `/teams/${id}/handover?view=closed`, label: t("closed") },
        ].map((x) => {
          const active = (x.key === "closed") === showClosed;
          return (
            <Link
              key={x.key}
              href={x.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-ink-muted"}`}
            >
              {x.label}
            </Link>
          );
        })}
      </nav>

      {handovers.length === 0 ? <EmptyState>{showClosed ? t("noClosed") : t("none")}</EmptyState> : null}

      <ul className="flex flex-col gap-3">
        {handovers.map((h) => {
          const cond = h.condition as HandoverCondition;
          const canClose = h.author_id === viewer.userId || editor;
          const comments = [...(h.comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
          return (
            <li key={h.id} id={`h-${h.id}`} className="scroll-mt-4">
              <Card className="relative flex flex-col gap-3 overflow-hidden">
                <span aria-hidden className={`absolute inset-y-0 start-0 w-1.5 ${CONDITION_BAR[cond]}`} />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-lg font-extrabold">
                      {h.patient}
                      {h.age != null ? <span className="text-sm font-semibold text-ink-muted"> · {t("years", { n: formatNumber(h.age, locale) })}</span> : null}
                    </span>
                    {h.bed ? (
                      <span className="flex items-center gap-1 text-sm text-ink-muted">
                        <BedDouble className="h-4 w-4" aria-hidden /> {h.bed}
                      </span>
                    ) : null}
                  </div>
                  <Badge tone={CONDITION_TONE[cond]}>{t(`cond.${cond}`)}</Badge>
                </div>
                {h.diagnosis ? <p className="font-semibold">{h.diagnosis}</p> : null}
                {h.tasks ? (
                  <div className="flex flex-col gap-1 rounded-xl bg-page p-3">
                    <span className="flex items-center gap-1 text-xs font-bold text-ink-muted">
                      <ClipboardList className="h-3.5 w-3.5" aria-hidden /> {t("tasks")}
                    </span>
                    <p className="text-sm whitespace-pre-line">{h.tasks}</p>
                  </div>
                ) : null}
                {h.notes ? <p className="text-sm whitespace-pre-line text-ink-muted">{h.notes}</p> : null}

                <p className="text-xs text-ink-muted">
                  {t("from", { name: name.get(h.author_id) ?? "—", when: formatDateTime(h.created_at, locale) })}
                  {h.to_doctor_id ? ` · ${t("toName", { name: name.get(h.to_doctor_id) ?? "—" })}` : null}
                </p>
                {h.received_by ? (
                  <p className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
                    <CheckCheck className="h-4 w-4" aria-hidden />
                    {t("receivedBy", { name: name.get(h.received_by) ?? "—", when: formatDateTime(h.received_at!, locale) })}
                  </p>
                ) : null}
                {h.closed_at ? (
                  <p className="text-sm text-ink-muted">{t("closedBy", { name: name.get(h.closed_by ?? "") ?? "—", when: formatDateTime(h.closed_at, locale) })}</p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {!h.received_by && !h.closed_at && h.author_id !== viewer.userId ? (
                    <ActionButton action={receiveHandover} fields={{ id: h.id }}>{t("receive")}</ActionButton>
                  ) : null}
                  {canClose ? (
                    <ActionButton action={closeHandover} fields={{ id: h.id, close: h.closed_at ? "0" : "1" }} variant="secondary">
                      {h.closed_at ? t("reopen") : t("close")}
                    </ActionButton>
                  ) : null}
                </div>

                <details open={comments.length > 0 && !h.closed_at}>
                  <summary className="cursor-pointer text-sm font-semibold text-brand-700">
                    {t("comments", { count: comments.length, n: formatNumber(comments.length, locale) })}
                  </summary>
                  <div className="flex flex-col gap-2 pt-2">
                    {comments.map((cm) => (
                      <div key={cm.id} className="rounded-xl bg-page px-3 py-2 text-sm">
                        <span className="font-semibold">{name.get(cm.author_id) ?? "—"}</span>
                        <span className="text-xs text-ink-muted"> · {formatDateTime(cm.created_at, locale)}</span>
                        <p className="whitespace-pre-line">{cm.body}</p>
                      </div>
                    ))}
                    {!h.closed_at ? <HandoverCommentForm handoverId={h.id} /> : null}
                  </div>
                </details>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
