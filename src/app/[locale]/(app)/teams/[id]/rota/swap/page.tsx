import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SwapForm } from "@/components/RotaForms";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import type { RotaSlot } from "@/lib/constants";
import { dayLabel, monthEnd, parseMonth, shiftMonth } from "@/lib/rota";
import { cairoToday, formatDate } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

/** Ask a colleague to swap or cover one of my duties. */
export default async function SwapPage({ params, searchParams }: PageProps<"/[locale]/teams/[id]/rota/swap">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const sp = await searchParams;
  const month = parseMonth(sp.month);
  const dutyId = typeof sp.duty === "string" && /^[0-9a-f-]{36}$/i.test(sp.duty) ? sp.duty : null;
  const t = await getTranslations("Rota");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const back = (
    <Link href={`/teams/${id}/rota?month=${month}`} className="text-sm font-semibold text-brand-700">
      <span aria-hidden className="inline-block rtl:rotate-180">←</span> {c("back")}
    </Link>
  );
  const supabase = await createClient();
  const { data: duty } = dutyId
    ? await supabase.from("team_duties").select("id, group_id, duty_date, slot, doctor_id").eq("id", dutyId).maybeSingle()
    : { data: null };
  if (!duty || duty.group_id !== id || duty.doctor_id !== viewer.userId) {
    return <div className="flex flex-col gap-4">{back}<EmptyState>{t("notFound")}</EmptyState></div>;
  }

  const today = cairoToday();
  // Colleagues, and their coming duties up to the end of next month.
  const until = monthEnd(shiftMonth(duty.duty_date.slice(0, 7), 1));
  const [{ data: memberRows }, { data: theirDuties }] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id, profile:profiles!group_members_user_id_fkey(full_name)")
      .eq("group_id", id)
      .eq("status", "active")
      .neq("user_id", viewer.userId),
    supabase
      .from("team_duties")
      .select("id, duty_date, slot, doctor_id")
      .eq("group_id", id)
      .neq("doctor_id", viewer.userId)
      .gte("duty_date", today)
      .lte("duty_date", until)
      .order("duty_date"),
  ]);
  const colleagues = (memberRows ?? [])
    .map((m) => ({ id: m.user_id, name: m.profile?.full_name ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const label = (d: { duty_date: string; slot: string }) =>
    `${dayLabel(d.duty_date, locale).weekday} ${formatDate(d.duty_date, locale)} · ${o(`rotaSlot.${d.slot as RotaSlot}`)}`;

  return (
    <div className="flex flex-col gap-4">
      {back}
      <PageTitle>{t("swapTitle")}</PageTitle>
      <Card className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">{t("yourDuty")}</span>
        <span className="text-lg font-bold">{label(duty)}</span>
      </Card>
      <Card>
        <SwapForm
          teamId={id}
          month={month}
          dutyId={duty.id}
          colleagues={colleagues}
          colleagueDuties={(theirDuties ?? []).map((d) => ({ id: d.id, doctorId: d.doctor_id, label: label(d) }))}
        />
        <p className="pt-3 text-xs text-ink-muted">{t("swapFlow")}</p>
      </Card>
    </div>
  );
}
