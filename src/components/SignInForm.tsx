"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "@/app/actions/auth";
import { Field, Input } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

export default function SignInForm() {
  const t = useTranslations("Auth");
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("email")} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" dir="ltr" required />
      </Field>
      <Field label={t("password")} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("signInButton")}</SubmitButton>
    </form>
  );
}
