"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { addHospital, approveDoctor, mergeHospitals, rejectDoctor, setDoctorRole } from "@/app/actions/admin";
import { CITIES, GRADES, requiredDocsFor, SPECIALTIES } from "@/lib/constants";
import { Checkbox, Field, Input, Select, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

export function ApproveDoctorForm({ userId, minDate, grade }: { userId: string; minDate: string; grade: string | null }) {
  const t = useTranslations("Admin");
  const [state, action] = useActionState(approveDoctor, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("syndicateExpiry")} htmlFor={`se-${userId}`}>
          <Input id={`se-${userId}`} name="syndicateExpiry" type="date" min={minDate} required dir="ltr" />
        </Field>
        {grade === "intern" ? (
          <Field label={t("internshipEnds")} htmlFor={`le-${userId}`}>
            <Input id={`le-${userId}`} name="letterExpiry" type="date" min={minDate} required dir="ltr" />
          </Field>
        ) : (
          <Field label={t("licenseExpiry")} htmlFor={`le-${userId}`}>
            <Input id={`le-${userId}`} name="licenseExpiry" type="date" min={minDate} required dir="ltr" />
          </Field>
        )}
      </div>
      <FormMessage state={state} success={t("approved")} />
      <SubmitButton>{t("approve")}</SubmitButton>
    </form>
  );
}

export function RejectDoctorForm({ userId, grade }: { userId: string; grade: string | null }) {
  const t = useTranslations("Admin");
  const d = useTranslations("Docs");
  const [state, action] = useActionState(rejectDoctor, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-sm font-semibold">{t("rejectDoc")}</legend>
        {requiredDocsFor(grade).map((k) => (
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

/**
 * Merge this hospital into another one (the other one is kept). Only
 * hospitals in the same city are offered; the admin confirms first.
 */
export function MergeHospitalForm({
  hospital,
  others,
}: {
  hospital: { id: string; name: string };
  others: { id: string; name: string }[];
}) {
  const t = useTranslations("Hospitals");
  const [state, action] = useActionState(mergeHospitals, undefined);
  const [keepId, setKeepId] = useState("");
  const keep = others.find((x) => x.id === keepId);
  if (others.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-brand-700">{t("mergeInto")}</summary>
      <form action={action} className="flex flex-col gap-2 pt-2">
        <input type="hidden" name="removeId" value={hospital.id} />
        <Field label={t("mergeKeep")} htmlFor={`merge-${hospital.id}`}>
          <Select
            id={`merge-${hospital.id}`}
            name="keepId"
            required
            value={keepId}
            onChange={(e) => setKeepId(e.target.value)}
          >
            <option value="" disabled>
              —
            </option>
            {others.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-ink-muted">{t("mergeExplain", { name: hospital.name })}</p>
        <FormMessage state={state} />
        <SubmitButton
          variant="danger"
          disabled={!keep}
          confirm={keep ? t("mergeConfirm", { remove: hospital.name, keep: keep.name }) : undefined}
        >
          {t("mergeButton")}
        </SubmitButton>
      </form>
    </details>
  );
}

/** Admin: change an approved doctor's grade or specialty. */
export function DoctorRoleForm({ id, grade, specialty }: { id: string; grade: string; specialty: string }) {
  const t = useTranslations("Admin");
  const o = useTranslations("Options");
  const [state, action] = useActionState(setDoctorRole, undefined);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-brand-700">{t("changeRole")}</summary>
      <form action={action} className="flex flex-col gap-2 pt-2">
        <input type="hidden" name="id" value={id} />
        <div className="grid grid-cols-2 gap-2">
          <Select name="specialty" defaultValue={specialty} aria-label={t("specialty")}>
            {SPECIALTIES.map((x) => (
              <option key={x} value={x}>{o(`specialty.${x}`)}</option>
            ))}
          </Select>
          <Select name="grade" defaultValue={grade} aria-label={t("grade")}>
            {GRADES.map((x) => (
              <option key={x} value={x}>{o(`grade.${x}`)}</option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-ink-muted">{t("changeRoleNote")}</p>
        <FormMessage state={state} />
        <SubmitButton variant="secondary">{t("saveRole")}</SubmitButton>
      </form>
    </details>
  );
}
