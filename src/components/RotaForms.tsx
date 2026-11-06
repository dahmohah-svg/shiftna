"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { addDuties, decideRota, removeDuty, requestSwap } from "@/app/actions/rota";
import { ROTA_SLOTS } from "@/lib/constants";
import { Field, Input, Select, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

type Member = { id: string; name: string };

/** Weekdays in Egyptian order, Saturday first (0 = Sunday). */
const WEEK = [6, 0, 1, 2, 3, 4, 5];

/** Managers and supervisors: put a doctor on a duty for one day, or many days at once. */
export function AddDutiesForm({
  teamId,
  month,
  members,
  first,
  last,
  weekdayNames,
}: {
  teamId: string;
  month: string;
  members: Member[];
  first: string;
  last: string;
  /** Short weekday names, indexed 0 = Sunday. */
  weekdayNames: string[];
}) {
  const t = useTranslations("Rota");
  const o = useTranslations("Options");
  const [state, action] = useActionState(addDuties, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="month" value={month} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("doctor")} htmlFor="r-doctor">
          <Select id="r-doctor" name="doctorId" required defaultValue="">
            <option value="" disabled>{t("choose")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("slot")} htmlFor="r-slot">
          <Select id="r-slot" name="slot" defaultValue="night">
            {ROTA_SLOTS.map((s) => (
              <option key={s} value={s}>{o(`rotaSlot.${s}`)}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("from")} htmlFor="r-from">
          <Input id="r-from" name="from" type="date" min={first} max={last} defaultValue={first} required dir="ltr" />
        </Field>
        <Field label={t("to")} hint={t("toHint")} htmlFor="r-to">
          <Input id="r-to" name="to" type="date" min={first} max={last} dir="ltr" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-sm font-semibold">{t("weekdays")}</legend>
        <div className="flex flex-wrap gap-2">
          {WEEK.map((d) => (
            <label key={d} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
              <input type="checkbox" name="days" value={d} className="accent-brand-600" />
              {weekdayNames[d]}
            </label>
          ))}
        </div>
        <span className="text-xs text-ink-muted">{t("weekdaysHint")}</span>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton>{t("add")}</SubmitButton>
    </form>
  );
}

/** A small × on a duty, for managers and supervisors. */
export function RemoveDutyButton({ id, label }: { id: string; label: string }) {
  const [, action, pending] = useActionState(removeDuty, undefined);
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={label}
        className="-me-1 flex h-6 w-6 items-center justify-center rounded-full text-ink-muted hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </form>
  );
}

/** Supervisor: send a waiting rota back with a note. */
export function ReturnRotaForm({ teamId, month }: { teamId: string; month: string }) {
  const t = useTranslations("Rota");
  const [state, action] = useActionState(decideRota, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="approve" value="0" />
      <Field label={t("returnNote")} htmlFor="r-note">
        <Textarea id="r-note" name="note" maxLength={300} required minLength={3} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">{t("returnRota")}</SubmitButton>
    </form>
  );
}

/** Ask a colleague to swap one of my duties for one of theirs, or to cover it. */
export function SwapForm({
  teamId,
  month,
  dutyId,
  colleagues,
  colleagueDuties,
}: {
  teamId: string;
  month: string;
  dutyId: string;
  colleagues: Member[];
  /** Coming duties of each colleague: label already formatted. */
  colleagueDuties: { id: string; doctorId: string; label: string }[];
}) {
  const t = useTranslations("Rota");
  const [state, action] = useActionState(requestSwap, undefined);
  const [target, setTarget] = useState("");
  const theirs = colleagueDuties.filter((d) => d.doctorId === target);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="dutyId" value={dutyId} />
      <Field label={t("colleague")} htmlFor="s-target">
        <Select id="s-target" name="targetId" required value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="" disabled>{t("choose")}</option>
          {colleagues.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>
      </Field>
      <Field label={t("inReturn")} hint={t("inReturnHint")} htmlFor="s-duty">
        <Select id="s-duty" name="targetDutyId" key={target} defaultValue="" disabled={!target}>
          <option value="">{t("justCover")}</option>
          {theirs.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </Select>
      </Field>
      <Field label={t("swapNote")} htmlFor="s-note">
        <Input id="s-note" name="note" maxLength={300} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("sendSwap")}</SubmitButton>
    </form>
  );
}
