"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/lib/errors";
import { buttonClass, Notice } from "./ui";

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  confirm,
  disabled,
}: {
  children: ReactNode;
  variant?: keyof typeof buttonClass;
  className?: string;
  /** Asks the user to confirm before submitting. */
  confirm?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const t = useTranslations("Common");
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={`${buttonClass[variant]} ${className}`}
    >
      {pending ? t("saving") : children}
    </button>
  );
}

/** Shows the error (or success text) returned by a server action. */
export function FormMessage({
  state,
  success,
}: {
  state: ActionState | undefined;
  success?: ReactNode;
}) {
  const t = useTranslations("Errors");
  if (!state) return null;
  if (state.error) return <Notice tone="danger">{t(state.error)}</Notice>;
  if (state.ok && success) return <Notice tone="success">{success}</Notice>;
  return null;
}
