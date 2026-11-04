"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addHospital, approveDoctor, rejectDoctor } from "@/app/actions/admin";
import { CITIES, REQUIRED_DOCS } from "@/lib/constants";
import { Checkbox, Field, Input, Select, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

export function ApproveDoctorForm({ userId, minDate }: { userId: string; minDate: string }) {
  const t = useTranslations("Admin");
  const [state, action] = useActionState(approveDoctor, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("syndicateExpiry")} htmlFor={`se-${userId}`}>
          <Input id={`se-${userId}`} name="syndicateExpiry" type="date" min={minDate} required dir="ltr" />
        </Field>
        <Field label={t("licenseExpiry")} htmlFor={`le-${userId}`}>
          <Input id={`le-${userId}`} name="licenseExpiry" type="date" min={minDate} required dir="ltr" />
        </Field>
      </div>
      <FormMessage state={state} success={t("approved")} />
      <SubmitButton>{t("approve")}</SubmitButton>
    </form>
  );
}

export function RejectDoctorForm({ userId }: { userId: string }) {
  const t = useTranslations("Admin");
  const d = useTranslations("Docs");
  const [state, action] = useActionState(rejectDoctor, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-sm font-semibold">{t("rejectDoc")}</legend>
        {REQUIRED_DOCS.map((k) => (
          <Checkbox key={k} name="types" value={k} label={d(k)} />
        ))}
      </fieldset>
      <Field label={t("rejectReason")} htmlFor={`rr-${userId}`}>
        <Textarea id={`rr-${userId}`} name="reason" minLength={3} maxLength={500} required />
      </Field>
      <FormMessage state={state} success={t("rejected")} />
      <SubmitButton variant="danger">{t("reject")}</SubmitButton>
    </form>
  );
}

export function AddHospitalForm() {
  const t = useTranslations("Admin");
  const o = useTranslations("Options");
  const c = useTranslations("Common");
  const sh = useTranslations("Shifts");
  const [state, action] = useActionState(addHospital, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label={t("name")} htmlFor="h-name">
        <Input id="h-name" name="name" minLength={2} maxLength={160} required />
      </Field>
      <Field label={sh("city")} htmlFor="h-city">
        <Select id="h-city" name="city" required defaultValue="">
          <option value="" disabled>—</option>
          {CITIES.map((x) => (
            <option key={x} value={x}>{o(`city.${x}`)}</option>
          ))}
        </Select>
      </Field>
      <Field label={`${t("area")} (${c("optional")})`} htmlFor="h-area">
        <Input id="h-area" name="area" maxLength={120} />
      </Field>
      <Field label={`${t("address")} (${c("optional")})`} htmlFor="h-address">
        <Input id="h-address" name="address" maxLength={300} />
      </Field>
      <Field label={`${t("contact")} (${c("optional")})`} htmlFor="h-contact">
        <Input id="h-contact" name="contact" maxLength={160} />
      </Field>
      <Checkbox name="verified" defaultChecked label={t("verified")} />
      <FormMessage state={state} />
      <SubmitButton>{t("add")}</SubmitButton>
    </form>
  );
}
