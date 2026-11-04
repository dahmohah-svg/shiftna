"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendOffer } from "@/app/actions/shifts";
import { Field, Notice, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

export default function OfferForm({
  shiftId,
  fatigueWarning,
}: {
  shiftId: string;
  fatigueWarning: boolean;
}) {
  const t = useTranslations("Shift");
  const [state, action] = useActionState(sendOffer, undefined);

  if (state?.ok) return <Notice tone="success">{t("offerSent")}</Notice>;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="shiftId" value={shiftId} />
      {fatigueWarning ? <Notice tone="warn">{t("fatigueWarn")}</Notice> : null}
      <Field label={t("offerMessage")} hint={t("offerMessageHint")} htmlFor="message">
        <Textarea id="message" name="message" maxLength={500} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("sendOffer")}</SubmitButton>
    </form>
  );
}
