"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addHospitalAsDoctor } from "@/app/actions/hospitals";
import { CITIES } from "@/lib/constants";
import { Field, Input, Select } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

/** Lets any approved doctor add a hospital while posting a shift. */
export default function AddHospitalInline({ defaultCity, open }: { defaultCity?: string; open?: boolean }) {
  const t = useTranslations("Hospitals");
  const o = useTranslations("Options");
  const sh = useTranslations("Shifts");
  const [state, action] = useActionState(addHospitalAsDoctor, undefined);

  return (
    <details className="rounded-2xl border border-line bg-surface" open={open}>
      <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-brand-700">
        {t("cantFind")}
      </summary>
      <form action={action} className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-sm text-ink-muted">{t("addIntro")}</p>
        <Field label={t("name")} hint={t("nameHint")} htmlFor="nh-name">
          <Input id="nh-name" name="name" minLength={3} maxLength={120} required />
        </Field>
        <Field label={sh("city")} htmlFor="nh-city">
          <Select id="nh-city" name="city" required defaultValue={defaultCity ?? ""}>
            <option value="" disabled>
              —
            </option>
            {CITIES.map((x) => (
              <option key={x} value={x}>
                {o(`city.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("area")} htmlFor="nh-area">
          <Input id="nh-area" name="area" maxLength={120} />
        </Field>
        <FormMessage state={state} />
        <SubmitButton variant="secondary">{t("add")}</SubmitButton>
      </form>
    </details>
  );
}
