import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ActionButton from "@/components/ActionButton";
import AlertForm from "@/components/AlertForm";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";
import { Card, EmptyState, PageTitle, SectionTitle } from "@/components/ui";
import { deleteAlert } from "@/app/actions/notifications";
import { createClient } from "@/lib/supabase/server";
import { isHr, requireApproved } from "@/lib/viewer";
import { DOC_TYPES, MAX_ALERTS, ROTA_SLOTS, type City, type DocType, type RotaSlot, type Specialty } from "@/lib/constants";
import { monthLabel } from "@/lib/rota";
import { isKnownKind, notificationHref, readPayload } from "@/lib/notifications";
import { formatDate, formatDateTime, formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

export default async function NotificationsPage({ params }: PageProps<"/[locale]/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const t = await getTranslations("Notifications");
  const o = await getTranslations("Options");
  const d = await getTranslations("Docs");
  const c = await getTranslations("Common");
  const supabase = await createClient();

  const [{ data: rows }, { data: alerts }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", viewer.userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("saved_alerts")
      .select("*")
      .eq("user_id", viewer.userId)
      .order("created_at", { ascending: true }),
  ]);

  const items = (rows ?? []).filter((n) => isKnownKind(n.kind));

  // Some older alerts only store the shift id; look up hospital and time for those.
  const missing = [
    ...new Set(
      items
        .map(readPayload)
        .filter((p) => p.shift_id && (!p.hospital || !p.start_at))
        .map((p) => p.shift_id!),
    ),
  ];
  const shiftInfo = new Map<string, { hospital?: string; start_at: string }>();
  if (missing.length > 0) {
    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, start_at, hospital:hospitals!shifts_hospital_id_fkey(name)")
      .in("id", missing);
    for (const sh of shifts ?? []) shiftInfo.set(sh.id, { hospital: sh.hospital?.name, start_at: sh.start_at });
  }

  const hasUnread = items.some((n) => !n.read_at);

  const docName = (type?: string) =>
    type && (DOC_TYPES as readonly string[]).includes(type) ? d(type as DocType) : c("dash");

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t("title")}</PageTitle>
      {hasUnread ? <MarkNotificationsRead /> : null}

      <section className="flex flex-col gap-2" aria-label={t("title")}>
        {items.length === 0 ? (
          <EmptyState>{t("empty")}</EmptyState>
        ) : (
          items.map((n) => {
            if (!isKnownKind(n.kind)) return null;
            const raw = readPayload(n);
            const extra = raw.shift_id ? shiftInfo.get(raw.shift_id) : undefined;
            const p = { ...raw, hospital: raw.hospital ?? extra?.hospital, start_at: raw.start_at ?? extra?.start_at };
            const text = t(`kinds.${n.kind}`, {
              hospital: p.hospital ?? c("dash"),
              when: p.start_at ? formatDateTime(p.start_at, locale) : c("dash"),
              doctor: p.doctor ?? c("dash"),
              sender: p.sender ?? c("dash"),
              document: docName(p.document),
              date: p.expires_on ? formatDate(p.expires_on, locale) : p.date ? formatDate(p.date, locale) : c("dash"),
              month: p.month ? monthLabel(p.month.slice(0, 7), locale) : c("dash"),
              slot: p.slot && (ROTA_SLOTS as readonly string[]).includes(p.slot) ? o(`rotaSlot.${p.slot as RotaSlot}`) : c("dash"),
              team: p.team ?? c("dash"),
              reason: p.reason ?? c("dash"),
              title: p.title ?? c("dash"),
            });
            const unread = !n.read_at;
            return (
              <Link
                key={n.id}
                href={notificationHref(n.kind, p)}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${unread ? "border-brand-200 bg-brand-50" : "border-line bg-surface"}`}
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${unread ? "bg-brand-600" : "bg-transparent"}`}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={`text-sm leading-relaxed ${unread ? "font-semibold text-ink" : "text-ink"}`}>
                    {text}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {unread ? <span className="sr-only">{t("unread")} · </span> : null}
                    {formatDateTime(n.created_at, locale)}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </section>

      {/* Shift alerts are for doctors; hospital HR search doctors instead. */}
      {!isHr(viewer.profile) ? (
      <Card className="flex flex-col gap-4">
        <div>
          <SectionTitle>{t("alertsTitle")}</SectionTitle>
          <p className="text-sm text-ink-muted">{t("alertsIntro")}</p>
        </div>
        {(alerts ?? []).length > 0 ? (
          <ul className="flex flex-col gap-2">
            {(alerts ?? []).map((a) => {
              const parts = [
                a.specialty ? o(`specialty.${a.specialty as Specialty}`) : t("anySpecialty"),
                a.city ? o(`city.${a.city as City}`) : t("anyCity"),
                a.shift_type ? o(`shiftType.${a.shift_type}`) : null,
                a.subspecialty ? o(`subspecialty.${a.subspecialty}`) : null,
                a.min_pay_egp ? t("minPayShort", { amount: formatNumber(a.min_pay_egp, locale) }) : null,
                a.immediate_only ? t("paidOnDay") : null,
                a.urgent_only ? t("urgentOnly") : null,
              ].filter(Boolean);
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-page px-3 py-2">
                  <span className="text-sm font-medium">{parts.join(" · ")}</span>
                  <ActionButton action={deleteAlert} fields={{ id: a.id }} variant="ghost">
                    {t("deleteAlert")}
                  </ActionButton>
                </li>
              );
            })}
          </ul>
        ) : null}
        {(alerts ?? []).length < MAX_ALERTS ? (
          <AlertForm defaultSpecialty={viewer.profile.specialty} />
        ) : (
          <p className="text-sm text-ink-muted">{t("tooManyAlerts", { max: MAX_ALERTS })}</p>
        )}
      </Card>
      ) : null}
    </div>
  );
}
