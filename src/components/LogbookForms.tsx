"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addLogbookEntry, requestSignoff, signEntries } from "@/app/actions/logbook";
import { LOGBOOK_ROLES, type Subspecialty } from "@/lib/constants";
import { buttonClass, Field, Input, Select, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

/** Add one logbook entry. */
export function AddLogbookEntryForm({ today, subspecialties }: { today: string; subspecialties: readonly Subspecialty[] }) {
  const t = useTranslations("Logbook");
  const o = useTranslations("Options");
  const [state, action] = useActionState(addLogbookEntry, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("date")} htmlFor="l-date">
          <Input id="l-date" name="date" type="date" max={today} defaultValue={today} required dir="ltr" />
        </Field>
        <Field label={t("role")} htmlFor="l-role">
          <Select id="l-role" name="role" defaultValue="performed">
            {LOGBOOK_ROLES.map((r) => (
              <option key={r} value={r}>{t(`roles.${r}`)}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("procedure")} hint={t("procedureHint")} htmlFor="l-proc">
        <Input id="l-proc" name="procedure" required minLength={2} maxLength={120} />
      </Field>
      <div className="grid grid-cols-[1fr_5rem_5rem] gap-3">
        <Field label={t("subspecialty")} htmlFor="l-sub">
          <Select id="l-sub" name="subspecialty" defaultValue="general">
            {subspecialties.map((s) => (
              <option key={s} value={s}>{o(`subspecialty.${s}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("cases")} htmlFor="l-cases">
          <Input id="l-cases" name="cases" type="number" inputMode="numeric" min={1} max={500} defaultValue={1} dir="ltr" />
        </Field>
        <Field label={t("hours")} htmlFor="l-hours">
          <Input id="l-hours" name="hours" type="number" inputMode="numeric" min={0} max={48} dir="ltr" />
        </Field>
      </div>
      <Field label={t("hospital")} htmlFor="l-hosp">
        <Input id="l-hosp" name="hospital" maxLength={160} />
      </Field>
      <Field label={t("note")} htmlFor="l-note">
        <Textarea id="l-note" name="note" maxLength={500} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("add")}</SubmitButton>
    </form>
  );
}

function SelectAll({ form, label }: { form: string; label: string }) {
  return (
    <button
      type="button"
      className={`${buttonClass.ghost} min-h-9 text-sm`}
      onClick={() => {
        const boxes = [...document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${form}"]`)];
        const all = boxes.every((b) => b.checked);
        boxes.forEach((b) => (b.checked = !all));
      }}
    >
      {label}
    </button>
  );
}

/** Doctor: send the ticked entries to one of my teams' supervisors. */
export function RequestSignoffForm({ teams }: { teams: { id: string; name: string }[] }) {
  const t = useTranslations("Logbook");
  const [state, action] = useActionState(requestSignoff, undefined);
  return (
    <form id="signoff-request" action={action} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Field label={t("sendTo")} htmlFor="l-team">
          <Select id="l-team" name="teamId" required defaultValue={teams.length === 1 ? teams[0].id : ""}>
            <option value="" disabled>{t("chooseTeam")}</option>
            {teams.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </Select>
        </Field>
        <SelectAll form="signoff-request" label={t("selectAll")} />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("requestSignoff")}</SubmitButton>
    </form>
  );
}

/** Supervisor: sign the ticked entries, or return them with a note. */
export function SignEntriesForm() {
  const t = useTranslations("Logbook");
  const [state, action] = useActionState(signEntries, undefined);
  return (
    <form id="signoff-sign" action={action} className="flex flex-col gap-2">
      <div className="flex justify-end">
        <SelectAll form="signoff-sign" label={t("selectAll")} />
      </div>
      <Field label={t("returnNote")} hint={t("returnNoteHint")} htmlFor="l-rnote">
        <Input id="l-rnote" name="note" maxLength={300} />
      </Field>
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" name="decision" value="sign" className={buttonClass.primary}>{t("sign")}</button>
        <button type="submit" name="decision" value="return" className={buttonClass.secondary}>{t("return")}</button>
      </div>
    </form>
  );
}
