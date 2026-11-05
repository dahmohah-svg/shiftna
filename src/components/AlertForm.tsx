"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createAlert } from "@/app/actions/notifications";
import { CITIES, MAX_ALERTS, SHIFT_TYPES, SUBSPECIALTIES } from "@/lib/constants";
import { Checkbox, Field, Input, Notice, Select } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

/** Save a shift alert: get notified when a matching shift is posted. */
export default function AlertForm() {
  const t = useTranslations("Notifications");
  const o = useTranslations("Options");
  const c = useTranslations("Common");
  const [state, action] = useActionState(createAlert, undefined);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="font-semibold">{t("newAlert")}</p>
      <Field label={t("city")} htmlFor="alert-city">
        <Select id="alert-city" name="city" defaultValue="">
          <option value="">{t("anyCity")}</option>
          {CITIES.map((x) => (
            <option key={x} value={x}>
              {o(`city.${x}`)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("type")} htmlFor="alert-type">
          <Select id="alert-type" name="type" defaultValue="">
            <option value="">{c("all")}</option>
            {SHIFT_TYPES.map((x) => (
              <option key={x} value={x}>
                {o(`shiftType.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("subspecialty")} htmlFor="alert-sub">
          <Select id="alert-sub" name="subspecialty" defaultValue="">
            <option value="">{c("all")}</option>
            {SUBSPECIALTIES.map((x) => (
              <option key={x} value={x}>
                {o(`subspecialty.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("minPay")} htmlFor="alert-pay">
        <Input id="alert-pay" name="minPay" type="number" inputMode="numeric" min={0} max={9999999} step={1} dir="ltr" />
      </Field>
      <Checkbox name="immediateOnly" label={t("paidOnDay")} />
      <Checkbox name="urgentOnly" label={t("urgentOnly")} />
      {state?.message === "tooManyAlerts" ? (
        <Notice tone="danger">{t("tooManyAlerts", { max: MAX_ALERTS })}</Notice>
      ) : state?.message === "duplicateAlert" ? (
        <Notice tone="warn">{t("duplicateAlert")}</Notice>
      ) : (
        <FormMessage state={state} success={t("alertSaved")} />
      )}
      <SubmitButton>{t("saveAlert")}</SubmitButton>
    </form>
  );
}
