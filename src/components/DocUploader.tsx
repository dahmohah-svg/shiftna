"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { recordDocument } from "@/app/actions/profile";
import { MAX_UPLOAD_BYTES, type DocType } from "@/lib/constants";
import type { ErrorKey } from "@/lib/errors";
import { Badge, buttonClass, Notice } from "./ui";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

type Status = "none" | "pending" | "approved" | "rejected";

/**
 * Uploads one document straight to the private "documents" bucket under the
 * user's own folder, then records it. The file contents never pass through
 * our server and are never shown back here.
 */
export default function DocUploader({
  userId,
  type,
  status,
  rejectReason,
}: {
  userId: string;
  type: DocType;
  status: Status;
  rejectReason?: string | null;
}) {
  const t = useTranslations("Onboarding");
  const d = useTranslations("Docs");
  const e = useTranslations("Errors");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const isSelfie = type === "selfie";

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ALLOWED.includes(file.type) || (isSelfie && file.type === "application/pdf")) {
      setError("fileType");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("fileTooBig");
      return;
    }
    setBusy(true);
    try {
      const path = `${userId}/${type}-${Date.now()}.${EXT[file.type]}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError("uploadFailed");
        return;
      }
      const res = await recordDocument(type, path);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      setError("uploadFailed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const badge =
    status === "approved" ? (
      <Badge tone="success">{t("approved")}</Badge>
    ) : status === "pending" ? (
      <Badge tone="brand">{t("uploaded")}</Badge>
    ) : status === "rejected" ? (
      <Badge tone="danger">{t("rejected", { reason: rejectReason ?? "" })}</Badge>
    ) : (
      <Badge>{t("notUploaded")}</Badge>
    );

  const canUpload = status !== "approved";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{d(type)}</h3>
        {badge}
      </div>
      {isSelfie ? <p className="text-xs text-ink-muted">{t("selfieHint")}</p> : null}
      {type === "hr_letter" ? <p className="text-xs text-ink-muted">{t("hrLetterHint")}</p> : null}
      {canUpload ? (
        <>
          <input
            ref={input}
            type="file"
            className="sr-only"
            id={`file-${type}`}
            accept={isSelfie ? "image/*" : "image/*,application/pdf"}
            capture={isSelfie ? "user" : undefined}
            onChange={(ev) => onPick(ev.target.files?.[0])}
            disabled={busy}
          />
          <label
            htmlFor={`file-${type}`}
            aria-disabled={busy}
            className={`${status === "none" ? buttonClass.primary : buttonClass.secondary} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            {busy
              ? t("uploading")
              : status === "none"
                ? isSelfie
                  ? t("takeSelfie")
                  : t("upload")
                : t("replace")}
          </label>
        </>
      ) : null}
      {error ? <Notice tone="danger">{e(error)}</Notice> : null}
    </div>
  );
}
