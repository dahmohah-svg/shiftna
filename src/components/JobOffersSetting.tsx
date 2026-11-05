"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setJobOffers } from "@/app/actions/profile";
import ActionButton from "./ActionButton";
import { Field, Input } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

/** Doctors: be found by hospital HR and receive job offers, with a short note on what they look for. */
export default function JobOffersSetting({ open, note }: { open: boolean; note: string }) {
  const t = useTranslations("Jobs");
  const [state, action] = useActionState(setJobOffers, undefined);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{t("settingTitle")}</span>
          <span className="text-xs text-ink-muted">{open ? t("settingOn") : t("settingOff")}</span>
        </div>
        <ActionButton
          action={setJobOffers}
          fields={{ open: open ? "0" : "1" }}
          variant={open ? "secondary" : "primary"}
          className="shrink-0"
        >
          {open ? t("turnOff") : t("turnOn")}
        </ActionButton>
      </div>
      {open ? (
        <form action={action} className="flex flex-col gap-2">
          <Field label={t("noteLabel")} hint={t("noteHint")} htmlFor="offerNote">
            <Input id="offerNote" name="note" defaultValue={note} maxLength={200} />
          </Field>
          <FormMessage state={state} />
          <SubmitButton variant="secondary">{t("saveNote")}</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
