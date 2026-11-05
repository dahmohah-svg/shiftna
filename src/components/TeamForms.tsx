"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createTeam, joinTeam, setTeamState } from "@/app/actions/teams";
import { createClient } from "@/lib/supabase/client";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { buttonClass, Field, Input, Notice, Select, Textarea } from "./ui";
import { FormMessage, SubmitButton } from "./forms";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

/** Create a team. The proof file goes straight to the doctor's private folder. */
export function CreateTeamForm({
  userId,
  hospitals,
}: {
  userId: string;
  hospitals: { id: string; label: string }[];
}) {
  const t = useTranslations("Teams");
  const e = useTranslations("Errors");
  const [state, action] = useActionState(createTeam, undefined);
  const [proofPath, setProofPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    const ext = ALLOWED[file.type];
    if (!ext) return setUploadError(e("fileType"));
    if (file.size > MAX_UPLOAD_BYTES) return setUploadError(e("fileTooBig"));
    setUploading(true);
    try {
      const path = `${userId}/team-proof-${Date.now()}.${ext}`;
      const { error } = await createClient()
        .storage.from("documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) return setUploadError(e("uploadFailed"));
      setProofPath(path);
      setFileName(file.name);
    } catch {
      setUploadError(e("uploadFailed"));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("name")} hint={t("nameHint")} htmlFor="team-name">
        <Input id="team-name" name="name" minLength={3} maxLength={80} required />
      </Field>
      <Field label={t("institution")} hint={t("institutionHint")} htmlFor="team-inst">
        <Input id="team-inst" name="institution" minLength={2} maxLength={120} required />
      </Field>
      <Field label={t("hospital")} htmlFor="team-hospital">
        <Select id="team-hospital" name="hospitalId" defaultValue="">
          <option value="">{t("noHospital")}</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("description")} htmlFor="team-desc">
        <Textarea id="team-desc" name="description" maxLength={500} />
      </Field>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink">{t("proof")}</p>
        <p className="text-xs text-ink-muted">{t("proofHint")}</p>
        <input type="hidden" name="proofPath" value={proofPath} />
        <label
          className={`${proofPath ? buttonClass.secondary : buttonClass.primary} cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? t("uploading") : proofPath ? t("proofReplace") : t("proofUpload")}
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(ev) => onPick(ev.target.files?.[0])}
          />
        </label>
        {proofPath ? <Notice tone="success">{t("proofUploaded", { name: fileName })}</Notice> : null}
        {uploadError ? <Notice tone="danger">{uploadError}</Notice> : null}
      </div>

      <FormMessage state={state} />
      <SubmitButton disabled={uploading}>{t("submitTeam")}</SubmitButton>
      <p className="text-xs text-ink-muted">{t("reviewNote")}</p>
    </form>
  );
}

export function JoinTeamForm({ code }: { code?: string }) {
  const t = useTranslations("Teams");
  const [state, action] = useActionState(joinTeam, undefined);
  if (state?.ok && state.message === "requestSent") {
    return <Notice tone="success">{t("requestSent")}</Notice>;
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label={t("code")} hint={t("codeHint")} htmlFor="team-code">
        <Input
          id="team-code"
          name="code"
          defaultValue={code ?? ""}
          dir="ltr"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
          required
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("join")}</SubmitButton>
    </form>
  );
}

/** Invite code with copy and share buttons (managers only). */
export function InviteBox({ code, link }: { code: string; link: string }) {
  const t = useTranslations("Teams");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("shareTitle"), text: t("shareText", { code }), url: link });
        return;
      } catch {
        // Cancelled: fall back to copying.
      }
    }
    copy();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-page px-3 py-3 text-center">
        <p className="text-xs text-ink-muted">{t("code")}</p>
        <p dir="ltr" className="font-mono text-2xl font-bold tracking-widest text-ink">
          {code}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={share} className={buttonClass.primary}>
          {t("share")}
        </button>
        <button type="button" onClick={copy} className={buttonClass.secondary}>
          {copied ? t("copied") : t("copyLink")}
        </button>
      </div>
      <p className="text-xs text-ink-muted">{t("inviteNote")}</p>
    </div>
  );
}

/** Admin: pause a team with a reason the creator will see. */
export function PauseTeamForm({ teamId }: { teamId: string }) {
  const t = useTranslations("Teams");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(setTeamState, undefined);
  if (state?.ok) return null;
  if (!open) {
    return (
      <button type="button" className={buttonClass.danger} onClick={() => setOpen(true)}>
        {t("pause")}
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="action" value="pause" />
      <Field label={t("pauseReason")} htmlFor={`pause-${teamId}`}>
        <Textarea id={`pause-${teamId}`} name="reason" minLength={3} maxLength={500} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="danger">{t("pause")}</SubmitButton>
    </form>
  );
}
