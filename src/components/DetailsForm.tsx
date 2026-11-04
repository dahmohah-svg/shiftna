"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveDetails } from "@/app/actions/profile";
import { CITIES, GRADES } from "@/lib/constants";
import { Field, Input, Select } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

export default function DetailsForm({
  defaults,
}: {
  defaults: { fullName: string; phone: string; grade: string; city: string };
}) {
  const t = useTranslations("Onboarding");
  const a = useTranslations("Auth");
  const o = useTranslations("Options");
  const [state, action] = useActionState(saveDetails, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={a("fullName")} htmlFor="fullName">
        <Input id="fullName" name="fullName" defaultValue={defaults.fullName} minLength={3} maxLength={120} required />
      </Field>
      <Field label={t("phone")} hint={t("phoneHint")} htmlFor="phone">
        <Input id="phone" name="phone" type="tel" inputMode="tel" dir="ltr" defaultValue={defaults.phone} autoComplete="tel" />
      </Field>
      <Field label={t("grade")} htmlFor="grade">
        <Select id="grade" name="grade" defaultValue={defaults.grade} required>
          <option value="" disabled>{t("choose")}</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>{o(`grade.${g}`)}</option>
          ))}
        </Select>
      </Field>
      <Field label={t("city")} htmlFor="city">
        <Select id="city" name="city" defaultValue={defaults.city} required>
          <option value="" disabled>{t("choose")}</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{o(`city.${c}`)}</option>
          ))}
        </Select>
      </Field>
      <FormMessage state={state} success={t("detailsSaved")} />
      <SubmitButton>{t("saveDetails")}</SubmitButton>
    </form>
  );
}
