import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatNumber } from "@/lib/time";
import { Check } from "lucide-react";
import ShiftCard from "./ShiftCard";
import TrustBadge from "./TrustBadge";
import VerifiedBadge from "./VerifiedBadge";
import { Badge, buttonClass } from "./ui";
import type { ShiftWithHospital } from "@/lib/shifts";

/**
 * "How Shiftna looks" on the welcome page: two phone frames built from the
 * app's real components with clearly labelled sample content. They follow
 * the visitor's language and light/dark setting, and never go out of date.
 */

function sampleShift(over: Partial<ShiftWithHospital>, name: string, area: string): ShiftWithHospital {
  return {
    id: "sample",
    poster_id: "sample",
    hospital_id: "sample",
    type: "shift",
    start_at: new Date().toISOString(),
    duration_hours: 12,
    pay_egp: 2400,
    payment: "immediate",
    payment_date: null,
    has_call_room: true,
    food_provided: true,
    workload: "moderate",
    support_staff: null,
    notes: null,
    urgent: false,
    status: "open",
    created_at: new Date().toISOString(),
    subspecialty: "general",
    min_grade: "resident",
    group_id: null,
    deal_kind: null,
    swap_note: null,
    instant_book: false,
    min_reliability_pct: null,
    min_shifts_done: 0,
    share_token: null,
    template_id: null,
    hospital: { id: "sample", name, city: "cairo", area, verified: true },
    ...over,
  } as ShiftWithHospital;
}

/** Tomorrow at the given Cairo hour, as an ISO time. */
function tomorrowAt(hour: number): string {
  const d = new Date(Date.now() + 86_400_000);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d);
  // Cairo is UTC+2 or UTC+3; +02:00 keeps the sample close enough.
  return new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+02:00`).toISOString();
}

function Phone({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <figure className="flex w-[86%] shrink-0 snap-center flex-col items-center gap-2 sm:w-[46%]">
      <div className="w-full rounded-[2.25rem] bg-phone-frame p-2 shadow-xl shadow-brand-600/20 ring-1 ring-line">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-page">
          <div className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-line" aria-hidden />
          <div className="pointer-events-none flex h-[23rem] flex-col gap-3 overflow-hidden p-3 select-none">
            {children}
          </div>
        </div>
      </div>
      <figcaption className="text-center text-sm font-semibold text-ink-muted">{caption}</figcaption>
    </figure>
  );
}

export default async function WelcomePreview() {
  const t = await getTranslations("Welcome");
  const sh = await getTranslations("Shift");
  const locale = await getLocale();
  const n = (x: number) => formatNumber(x, locale);

  const night = sampleShift(
    { start_at: tomorrowAt(20), subspecialty: "cardiac", urgent: true, pay_egp: 3000, min_grade: "specialist" },
    t("sampleHospital1"),
    t("sampleArea1"),
  );
  const day = sampleShift(
    { start_at: tomorrowAt(8), subspecialty: "pediatric", duration_hours: 6, pay_egp: 1400, type: "per_case" },
    t("sampleHospital2"),
    t("sampleArea2"),
  );

  return (
    <section className="flex flex-col gap-3" aria-labelledby="preview-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="preview-title" className="text-xl font-bold text-ink">
          {t("previewTitle")}
        </h2>
        <Badge>{t("example")}</Badge>
      </div>
      {/* The frames are pictures of the app: screen readers get the captions. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
        <Phone caption={t("captionShifts")}>
          <div aria-hidden className="flex flex-col gap-3">
            <ShiftCard shift={night} trust="verified" preview />
            <ShiftCard shift={day} trust="trusted" preview />
          </div>
        </Phone>
        <Phone caption={t("captionOffers")}>
          <div aria-hidden className="flex flex-col gap-3">
            <p className="text-lg font-extrabold text-ink">{sh("offersTitle")}</p>
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 font-bold text-ink">
                    {t("sampleDoctor")}
                    <VerifiedBadge compact />
                  </span>
                  <span className="text-xs text-ink-muted">{t("sampleGrade")}</span>
                </div>
                <TrustBadge badge="gold" />
              </div>
              <VerifiedBadge />
              <p className="rounded-lg bg-page p-2 text-sm text-ink">{t("sampleMessage")}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  [t("statRating"), `${n(4.9)} ★`],
                  [t("statShifts"), n(38)],
                  [t("statShowUp"), `${n(100)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-page p-2">
                    <p className="text-[10px] text-ink-muted">{k}</p>
                    <p className="text-sm font-bold text-ink">{v}</p>
                  </div>
                ))}
              </div>
              <span className={`${buttonClass.primary} min-h-9 py-1.5 text-sm`}>
                <Check className="h-4 w-4" aria-hidden />
                {sh("accept")}
              </span>
            </div>
          </div>
        </Phone>
      </div>
    </section>
  );
}
