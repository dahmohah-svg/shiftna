"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { cancelBooking, fileReport, submitRating } from "@/app/actions/bookings";
import { buttonClass, Field, Notice, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

export function CancelBookingForm({
  bookingId,
  late,
  isDoctor,
}: {
  bookingId: string;
  late: boolean;
  isDoctor: boolean;
}) {
  const t = useTranslations("Booking");
  const c = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cancelBooking, undefined);

  if (!open) {
    return (
      <button type="button" className={buttonClass.danger} onClick={() => setOpen(true)}>
        {t("cancel")}
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-red-200 p-3">
      <input type="hidden" name="id" value={bookingId} />
      {late ? <Notice tone="warn">{t("cancelWarnLate")}</Notice> : null}
      {isDoctor ? <Notice>{t("cancelWarnDoctor")}</Notice> : null}
      <Field label={t("cancelReason")} htmlFor="cancel-reason">
        <Textarea id="cancel-reason" name="reason" minLength={3} maxLength={500} required />
      </Field>
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-2">
        <SubmitButton variant="danger">{t("cancelConfirm")}</SubmitButton>
        <button type="button" className={buttonClass.secondary} onClick={() => setOpen(false)}>
          {c("back")}
        </button>
      </div>
    </form>
  );
}

function Stars({ name, label }: { name: string; label: string }) {
  const [value, setValue] = useState(0);
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="flex gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              required
              className="sr-only"
              onChange={() => setValue(n)}
            />
            <span
              aria-hidden
              className={`text-3xl leading-none ${n <= value ? "text-amber-500" : "text-line"}`}
            >
              ★
            </span>
            <span className="sr-only">{n}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RatingForm({ bookingId, ratesDoctor }: { bookingId: string; ratesDoctor: boolean }) {
  const t = useTranslations("Booking");
  const c = useTranslations("Common");
  const [state, action] = useActionState(submitRating, undefined);
  if (state?.ok) return <Notice tone="success">{t("ratingSubmitted")}</Notice>;

  const labels = ratesDoctor
    ? [t("skill"), t("reliability"), t("punctuality")]
    : [t("payAsAgreed"), t("paidOnTime"), t("workloadAsDescribed")];

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={bookingId} />
      <p className="text-sm text-ink-muted">
        {ratesDoctor ? t("rateDoctorIntro") : t("rateHospitalIntro")}
      </p>
      <Stars name="s1" label={labels[0]} />
      <Stars name="s2" label={labels[1]} />
      <Stars name="s3" label={labels[2]} />
      <Field label={`${t("comment")} (${c("optional")})`} htmlFor="rating-comment">
        <Textarea id="rating-comment" name="comment" maxLength={1000} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("submitRating")}</SubmitButton>
    </form>
  );
}

export function ReportForm({ bookingId }: { bookingId: string }) {
  const t = useTranslations("Booking");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(fileReport, undefined);
  if (state?.ok) return <Notice tone="success">{t("reportSent")}</Notice>;
  if (!open) {
    return (
      <button type="button" className={buttonClass.ghost} onClick={() => setOpen(true)}>
        {t("report")}
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={bookingId} />
      <Field label={t("reportReason")} htmlFor="report-reason">
        <Textarea id="report-reason" name="reason" minLength={5} maxLength={1000} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">{t("report")}</SubmitButton>
    </form>
  );
}
