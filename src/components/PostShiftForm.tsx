"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { postShift } from "@/app/actions/shifts";
import {
  GRADES,
  PAYMENT_TYPES,
  SHIFT_TYPES,
  SUBSPECIALTIES,
  WORKLOADS,
} from "@/lib/constants";
import { Checkbox, Field, Input, Notice, Select, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

type HospitalOption = { id: string; name: string; cityLabel: string };

export default function PostShiftForm({
  hospitals,
  minStart,
}: {
  hospitals: HospitalOption[];
  minStart: string;
}) {
  const t = useTranslations("Post");
  const o = useTranslations("Options");
  const c = useTranslations("Common");
  const [state, action] = useActionState(postShift, undefined);
  const [payment, setPayment] = useState<string>("immediate");

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("hospital")} htmlFor="hospitalId">
        <Select id="hospitalId" name="hospitalId" required defaultValue="">
          <option value="" disabled>—</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} · {h.cityLabel}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("type")} htmlFor="type">
          <Select id="type" name="type" defaultValue="shift">
            {SHIFT_TYPES.map((x) => (
              <option key={x} value={x}>{o(`shiftType.${x}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("subspecialty")} htmlFor="subspecialty">
          <Select id="subspecialty" name="subspecialty" defaultValue="general">
            {SUBSPECIALTIES.map((x) => (
              <option key={x} value={x}>{o(`subspecialty.${x}`)}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={t("start")} htmlFor="startLocal">
        <Input id="startLocal" name="startLocal" type="datetime-local" min={minStart} required dir="ltr" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("duration")} htmlFor="durationHours">
          <Input id="durationHours" name="durationHours" type="number" inputMode="numeric" min={1} max={48} defaultValue={12} required />
        </Field>
        <Field label={t("pay")} htmlFor="payEgp">
          <Input id="payEgp" name="payEgp" type="number" inputMode="numeric" min={1} step={1} required />
        </Field>
      </div>

      <Field label={t("payment")} htmlFor="payment">
        <Select id="payment" name="payment" value={payment} onChange={(e) => setPayment(e.target.value)}>
          {PAYMENT_TYPES.map((x) => (
            <option key={x} value={x}>{o(`payment.${x}`)}</option>
          ))}
        </Select>
      </Field>
      {payment === "on_date" ? (
        <Field label={t("paymentDate")} htmlFor="paymentDate">
          <Input id="paymentDate" name="paymentDate" type="date" required dir="ltr" min={minStart.slice(0, 10)} />
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("minGrade")} htmlFor="minGrade">
          <Select id="minGrade" name="minGrade" defaultValue="resident">
            {GRADES.map((x) => (
              <option key={x} value={x}>{o(`grade.${x}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("workload")} htmlFor="workload">
          <Select id="workload" name="workload" defaultValue="moderate">
            {WORKLOADS.map((x) => (
              <option key={x} value={x}>{o(`workload.${x}`)}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Checkbox name="hasCallRoom" label={t("callRoom")} />
        <Checkbox name="foodProvided" label={t("food")} />
        <Checkbox name="urgent" label={t("urgent")} />
      </div>

      <Field label={`${t("supportStaff")} (${c("optional")})`} hint={t("supportStaffHint")} htmlFor="supportStaff">
        <Input id="supportStaff" name="supportStaff" maxLength={200} />
      </Field>
      <Field label={`${t("notes")} (${c("optional")})`} htmlFor="notes">
        <Textarea id="notes" name="notes" maxLength={1000} />
      </Field>

      {state?.message === "startInPast" ? <Notice tone="danger">{t("startInPast")}</Notice> : null}
      {state?.message === "paymentDateNeeded" ? <Notice tone="danger">{t("paymentDateNeeded")}</Notice> : null}
      {!state?.message ? <FormMessage state={state} /> : null}
      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
