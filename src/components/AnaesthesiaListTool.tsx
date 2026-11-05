"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PATIENT_LIST_BUCKET, PATIENT_LIST_MAX_BYTES } from "@/lib/constants";
import { buttonClass, Card, Field, Notice, SectionTitle, Textarea } from "./ui";

type Result = {
  fileName: string;
  docx: string;
  rooms: { heading: string; count: number }[];
  reviewItems: string[];
  questions: string[];
  qualityNotes: string[];
};

const ERRORS = [
  "notSignedIn",
  "notApproved",
  "invalid",
  "notConfigured",
  "fileMissing",
  "fileTooBig",
  "fileType",
  "refused",
  "tooLong",
  "aiFailed",
  "busy",
  "uploadFailed",
] as const;
type ErrorCode = (typeof ERRORS)[number];

function toBlobUrl(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return URL.createObjectURL(blob);
}

/**
 * Upload one PDF (list + patient sheets) and get back the formatted Word list.
 * The PDF goes to the doctor's own private folder, the server reads it once
 * with Claude and deletes it. Nothing is saved.
 */
export default function AnaesthesiaListTool({ userId }: { userId: string }) {
  const t = useTranslations("AnaesthesiaList");
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.type !== "application/pdf") return setError("fileType");
    if (f.size > PATIENT_LIST_MAX_BYTES) return setError("fileTooBig");
    setFile(f);
  }

  async function build() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);

    const supabase = createClient();
    const storage = supabase.storage.from(PATIENT_LIST_BUCKET);
    const path = `${userId}/${crypto.randomUUID()}.pdf`;
    try {
      const { error: upErr } = await storage.upload(path, file, { contentType: "application/pdf" });
      if (upErr) return setError("uploadFailed");

      const res = await fetch("/api/anaesthesia-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, notes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.docx) {
        const code = data?.error as ErrorCode | undefined;
        setError(code && ERRORS.includes(code) ? code : "aiFailed");
        // The server deletes the PDF; this covers a request that never got there.
        await storage.remove([path]).catch(() => {});
        return;
      }
      setResult(data as Result);
      setUrl(toBlobUrl(data.docx));
    } catch {
      setError("aiFailed");
      await storage.remove([path]).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const flagged = result ? [...result.qualityNotes, ...result.questions, ...result.reviewItems] : [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <button type="button" className={buttonClass.secondary} onClick={() => input.current?.click()} disabled={busy}>
          <FileText className="h-5 w-5" aria-hidden />
          {file ? t("changePdf") : t("choosePdf")}
        </button>
        {file ? (
          <p className="text-sm text-ink-muted" dir="ltr">
            {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        ) : null}
        <Field label={t("notesLabel")} hint={t("notesHint")} htmlFor="list-notes">
          <Textarea
            id="list-notes"
            rows={3}
            maxLength={4000}
            dir="ltr"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </Field>
        <button type="button" className={buttonClass.primary} onClick={build} disabled={!file || busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {busy ? t("working") : t("build")}
        </button>
        {busy ? <p className="text-sm text-ink-muted">{t("workingHint")}</p> : null}
        {error ? <Notice tone="danger">{t(`errors.${error}`)}</Notice> : null}
      </Card>

      {result && url ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("ready")}</SectionTitle>
          <a href={url} download={result.fileName} className={buttonClass.primary}>
            <Download className="h-5 w-5" aria-hidden />
            {t("download")}
          </a>
          <ul className="text-sm text-ink" dir="ltr">
            {result.rooms.map((r) => (
              <li key={r.heading}>
                {r.heading}: {r.count}
              </li>
            ))}
          </ul>
          {flagged.length ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">{t("review", { count: flagged.length })}</span>
              <ul className="list-disc ps-5 text-sm text-ink" dir="ltr">
                {flagged.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <Notice tone="success">{t("nothingFlagged")}</Notice>
          )}
          {result.questions.length ? <p className="text-sm text-ink-muted">{t("answerHint")}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
