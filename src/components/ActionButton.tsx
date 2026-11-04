"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/errors";
import type { buttonClass } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

type Action = (prev: ActionState | undefined, formData: FormData) => Promise<ActionState>;

/** A one-button form that sends hidden values to a server action. */
export default function ActionButton({
  action,
  fields,
  children,
  variant = "primary",
  confirm,
  success,
  className = "",
}: {
  action: Action;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: keyof typeof buttonClass;
  confirm?: string;
  success?: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={`flex flex-col gap-2 ${className}`}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} confirm={confirm}>
        {children}
      </SubmitButton>
      <FormMessage state={state} success={success} />
    </form>
  );
}
