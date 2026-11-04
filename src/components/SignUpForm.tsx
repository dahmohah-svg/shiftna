"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signUp } from "@/app/actions/auth";
import { Field, Input, Notice } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

export default function SignUpForm() {
  const t = useTranslations("Auth");
  const [state, action] = useActionState(signUp, undefined);

  if (state?.ok && state.message) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t("checkEmailTitle")}</h2>
        <Notice>{t("checkEmailBody", { email: state.message })}</Notice>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("fullName")} htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" minLength={3} maxLength={120} required />
      </Field>
      <Field label={t("email")} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" dir="ltr" required />
      </Field>
      <Field label={t("password")} hint={t("passwordHint")} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} dir="ltr" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("signUpButton")}</SubmitButton>
      <p className="text-xs text-ink-muted">{t("agree")}</p>
    </form>
  );
}
