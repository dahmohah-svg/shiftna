"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addHandoverComment, createHandover } from "@/app/actions/handover";
import { HANDOVER_CONDITIONS } from "@/lib/constants";
import { Field, Input, Select, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

/** Write a handover for one patient, optionally to the colleague taking over. */
export function NewHandoverForm({
  teamId,
  colleagues,
  defaultTo,
}: {
  teamId: string;
  colleagues: { id: string; name: string }[];
  /** The colleague on the next duty in the rota, if any. */
  defaultTo?: string;
}) {
  const t = useTranslations("Handover");
  const [state, action] = useActionState(createHandover, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="teamId" value={teamId} />
      <div className="grid grid-cols-[1fr_5.5rem] gap-3">
        <Field label={t("patient")} htmlFor="h-patient">
          <Input id="h-patient" name="patient" required maxLength={120} />
        </Field>
        <Field label={t("age")} htmlFor="h-age">
          <Input id="h-age" name="age" type="number" inputMode="numeric" min={0} max={130} dir="ltr" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("bed")} htmlFor="h-bed">
          <Input id="h-bed" name="bed" maxLength={40} />
        </Field>
        <Field label={t("condition")} htmlFor="h-cond">
          <Select id="h-cond" name="condition" defaultValue="stable">
            {HANDOVER_CONDITIONS.map((c) => (
              <option key={c} value={c}>{t(`cond.${c}`)}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("diagnosis")} htmlFor="h-dx">
        <Input id="h-dx" name="diagnosis" maxLength={300} />
      </Field>
      <Field label={t("tasks")} hint={t("tasksHint")} htmlFor="h-tasks">
        <Textarea id="h-tasks" name="tasks" maxLength={2000} />
      </Field>
      <Field label={t("notes")} htmlFor="h-notes">
        <Textarea id="h-notes" name="notes" maxLength={2000} />
      </Field>
      <Field label={t("to")} hint={t("toHint")} htmlFor="h-to">
        <Select id="h-to" name="toDoctorId" defaultValue={defaultTo ?? ""}>
          <option value="">{t("toAnyone")}</option>
          {colleagues.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("send")}</SubmitButton>
    </form>
  );
}

export function HandoverCommentForm({ handoverId }: { handoverId: string }) {
  const t = useTranslations("Handover");
  const [state, action] = useActionState(addHandoverComment, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="handoverId" value={handoverId} />
      <div className="flex gap-2">
        <Input name="body" required maxLength={1000} placeholder={t("commentPlaceholder")} aria-label={t("commentPlaceholder")} />
        <SubmitButton variant="secondary" className="shrink-0">{t("comment")}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
