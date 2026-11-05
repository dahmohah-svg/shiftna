"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveDetails } from "@/app/actions/profile";
import { CITIES, GRADES, SPECIALTIES } from "@/lib/constants";
import { Field, Input, Select } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

export default function DetailsForm({
  defaults,
  locked = false,
}: {
  defaults: { fullName: string; phone: string; grade: string; specialty: string; city: string };
  /** Approved doctors: grade and specialty were checked and can't be changed here. */
  locked?: boolean;
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
      {locked ? (
        <div className="flex flex-col gap-1 rounded-xl bg-page px-3 py-2.5 text-sm">
          <span className="font-semibold text-ink">
            {o(`specialty.${defaults.specialty as (typeof SPECIALTIES)[number]}`)} · {o(`grade.${defaults.grade as (typeof GRADES)[number]}`)}
          </span>
          <span className="text-xs text-ink-muted">{t("lockedNote")}</span>
        </div>
      ) : (
        <>
          <Field label={t("specialty")} htmlFor="specialty">
            <Select id="specialty" name="specialty" defaultValue={defaults.specialty} required>
              <option value="" disabled>{t("choose")}</option>
              {SPECIALTIES.map((x) => (
                <option key={x} value={x}>{o(`specialty.${x}`)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("grade")} hint={t("gradeHint")} htmlFor="grade">
            <Select id="grade" name="grade" defaultValue={defaults.grade} required>
              <option value="" disabled>{t("choose")}</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{o(`grade.${g}`)}</option>
              ))}
            </Select>
          </Field>
        </>
      )}
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
