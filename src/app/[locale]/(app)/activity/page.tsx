import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import JobOfferList from "@/components/JobOfferList";
import ShiftCard from "@/components/ShiftCard";
import { Badge, buttonClass, EmptyState, PageTitle, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { isHr, requireApproved } from "@/lib/viewer";
import { getMyJobOffers } from "@/lib/jobs";
import { SHIFT_WITH_HOSPITAL, type ShiftWithHospital } from "@/lib/shifts";
import { formatDateTime, formatNumber, nowMs } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

export default async function ActivityPage({ params }: PageProps<"/[locale]/activity">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const t = await getTranslations("Activity");
  const s = await getTranslations("Shifts");
  const o = await getTranslations("Options");
  const b = await getTranslations("Booking");
  const supabase = await createClient();
  const me = viewer.userId;
  const hr = isHr(viewer.profile);
  const j = await getTranslations("Jobs");

  const [{ data: myShifts }, { data: myOffers }, { data: bookings }, jobOffers] = await Promise.all([
    supabase
      .from("shifts")
      .select(`${SHIFT_WITH_HOSPITAL}, offers(id, status)`)
      .eq("poster_id", me)
      .eq("status", "open")
      .order("start_at", { ascending: true }),
    supabase
      .from("offers")
      .select(`id, status, shift:shifts!offers_shift_id_fkey(${SHIFT_WITH_HOSPITAL})`)
      .eq("doctor_id", me)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select(
        "id, doctor_id, poster_id, cancelled_at, doctor_completed, poster_completed, shift:shifts!bookings_shift_id_fkey(start_at, duration_hours, hospital:hospitals!shifts_hospital_id_fkey(name))",
      )
      .or(`doctor_id.eq.${me},poster_id.eq.${me}`)
      .order("created_at", { ascending: false })
      .limit(100),
    getMyJobOffers(supabase, me),
  ]);

  const now = nowMs();
  const sorted = (bookings ?? []).filter((x) => x.shift);
  const upcoming = sorted
    .filter((x) => !x.cancelled_at && new Date(x.shift!.start_at).getTime() + x.shift!.duration_hours * 3600_000 > now)
    .sort((a, b2) => a.shift!.start_at.localeCompare(b2.shift!.start_at));
  const past = sorted.filter((x) => !upcoming.includes(x));

  const bookingRow = (x: (typeof sorted)[number]) => (
    <Link
      key={x.id}
      href={`/bookings/${x.id}`}
      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-bold">{x.shift!.hospital?.name}</span>
        <span className="text-sm text-ink-muted">{formatDateTime(x.shift!.start_at, locale)}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone="brand">{x.doctor_id === me ? t("asDoctor") : t("asPoster")}</Badge>
        {x.cancelled_at ? (
          <Badge tone="danger">{b("cancelled")}</Badge>
        ) : x.doctor_completed && x.poster_completed ? (
          <Badge tone="success">{o("shiftStatus.completed")}</Badge>
        ) : null}
      </div>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t("title")}</PageTitle>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("bookings")} · {t("upcoming")}</SectionTitle>
        {upcoming.length === 0 ? <EmptyState action={!hr ? <Link href="/shifts" className={buttonClass.secondary}>{t("browseShifts")}</Link> : undefined}>{t("noBookings")}</EmptyState> : upcoming.map(bookingRow)}
      </section>

      {/* Doctors only see this once a hospital has sent them an offer. */}
      {hr || jobOffers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>{j("sectionTitle")}</SectionTitle>
          <JobOfferList offers={jobOffers} me={me} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("myShifts")}</SectionTitle>
        {(myShifts ?? []).length === 0 ? (
          <EmptyState action={<Link href="/post" className={buttonClass.secondary}>{t("postShift")}</Link>}>{t("noShifts")}</EmptyState>
        ) : (
          (myShifts ?? []).map((x) => {
            const pending = (x.offers ?? []).filter((y) => y.status === "pending").length;
            return (
              <div key={x.id} className="flex flex-col gap-1">
                <ShiftCard shift={x as unknown as ShiftWithHospital} mine />
                <p className="px-2 text-sm font-semibold text-brand-700">{s("offersCount", { count: pending, n: formatNumber(pending, locale) })}</p>
              </div>
            );
          })
        )}
      </section>

      {!hr ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>{t("myOffers")}</SectionTitle>
          {(myOffers ?? []).length === 0 ? (
            <EmptyState action={<Link href="/shifts" className={buttonClass.secondary}>{t("browseShifts")}</Link>}>{t("noOffers")}</EmptyState>
          ) : (
            (myOffers ?? []).map((x) =>
              x.shift ? <ShiftCard key={x.id} shift={x.shift as unknown as ShiftWithHospital} /> : null,
            )
          )}
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>{t("bookings")} · {t("past")}</SectionTitle>
          {past.map(bookingRow)}
        </section>
      ) : null}

    </div>
  );
}
