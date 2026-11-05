"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { sendJobOffer } from "@/app/actions/jobs";
import { JOB_KINDS, PAY_PERIODS } from "@/lib/constants";
import { Field, Input, Notice, Select, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

/** HR: offer a doctor one of the hospital's open shifts, or a part- or full-time job. */
export default function JobOfferForm({
  doctorId,
  shifts,
  defaultShift,
}: {
  doctorId: string;
  /** The hospital's open shifts the doctor's grade allows. */
  shifts: { id: string; label: string }[];
  defaultShift?: string;
}) {
  const t = useTranslations("Jobs");
  const o = useTranslations("Options");
  const [state, action] = useActionState(sendJobOffer, undefined);
  const [kind, setKind] = useState<string>(defaultShift ? "shift" : "full_time");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="doctorId" value={doctorId} />
      <Field label={t("kind")} htmlFor="kind">
        <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {JOB_KINDS.map((k) => (
            <option key={k} value={k}>{o(`jobKind.${k}`)}</option>
          ))}
        </Select>
      </Field>
      {kind === "shift" ? (
        shifts.length > 0 ? (
          <Field label={t("shift")} hint={t("shiftHint")} htmlFor="shiftId">
            <Select id="shiftId" name="shiftId" defaultValue={defaultShift ?? ""} required>
              <option value="" disabled>{t("chooseShift")}</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <Notice tone="warn">{t("noOpenShifts")}</Notice>
        )
      ) : null}
      <Field label={t("jobTitle")} hint={t("jobTitleHint")} htmlFor="title">
        <Input id="title" name="title" minLength={3} maxLength={120} required />
      </Field>
      <Field label={t("details")} hint={t("detailsHint")} htmlFor="details">
        <Textarea id="details" name="details" maxLength={2000} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("pay")} htmlFor="payEgp">
          <Input id="payEgp" name="payEgp" type="number" inputMode="numeric" min={1} max={9999999} step={1} dir="ltr" />
        </Field>
        <Field label={t("payPeriod")} htmlFor="payPeriod">
          <Select id="payPeriod" name="payPeriod" key={kind} defaultValue={kind === "shift" ? "shift" : "month"}>
            {PAY_PERIODS.map((p) => (
              <option key={p} value={p}>{o(`payPeriod.${p}`)}</option>
            ))}
          </Select>
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton disabled={kind === "shift" && shifts.length === 0}>{t("send")}</SubmitButton>
    </form>
  );
}
