import { getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck, CheckCircle2, Clock, Undo2 } from "lucide-react";
import ActionButton from "./ActionButton";
import { Badge } from "./ui";
import { deleteLogbookEntry } from "@/app/actions/logbook";
import type { LogbookEntry } from "@/lib/logbook";
import { formatDate, formatNumber } from "@/lib/time";

/** One logbook entry with its sign-off state; optionally a tick box for a sign-off form. */
export default async function LogbookEntryCard({
  e,
  signerName,
  teamName,
  selectForm,
  canDelete,
}: {
  e: LogbookEntry;
  signerName?: string;
  teamName?: string;
  /** Id of the form a tick box belongs to, when the entry can be selected. */
  selectForm?: string;
  canDelete?: boolean;
}) {
  const t = await getTranslations("Logbook");
  const o = await getTranslations("Options");
  const locale = await getLocale();
  const n = (x: number) => formatNumber(x, locale);
  const title = e.procedure ?? (e.booking_id ? t("shiftEntry") : o(`subspecialty.${e.subspecialty as "general"}`));
  const details = [
    e.role ? t(`roles.${e.role as "performed"}`) : null,
    o(`subspecialty.${e.subspecialty as "general"}`),
    e.cases_count ? t("casesN", { n: n(e.cases_count) }) : null,
    e.hours ? t("hoursN", { n: n(e.hours) }) : null,
    e.hospital?.name ?? e.hospital_name,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
      {selectForm ? (
        <input type="checkbox" name="ids" value={e.id} form={selectForm} aria-label={title} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold">{title}</span>
          <span className="shrink-0 text-xs text-ink-muted">{formatDate(e.entry_date, locale)}</span>
        </div>
        <span className="text-sm text-ink-muted">{details.join(" · ")}</span>
        {e.note ? <p className="text-sm whitespace-pre-line">{e.note}</p> : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {e.verified ? (
            <Badge tone="success"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {t("verifiedShift")}</Badge>
          ) : e.sign_status === "signed" ? (
            <Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {t("signedBy", { name: signerName ?? "—", date: formatDate(e.signed_at!, locale) })}</Badge>
          ) : e.sign_status === "requested" ? (
            <Badge tone="warn"><Clock className="h-3.5 w-3.5" aria-hidden /> {t("waiting", { team: teamName ?? "—" })}</Badge>
          ) : e.sign_status === "returned" ? (
            <Badge tone="danger"><Undo2 className="h-3.5 w-3.5" aria-hidden /> {t("returned")}</Badge>
          ) : (
            <Badge>{t("notSigned")}</Badge>
          )}
          {canDelete && !e.verified && e.sign_status !== "signed" ? (
            <ActionButton action={deleteLogbookEntry} fields={{ id: e.id }} variant="ghost" confirm={t("deleteConfirm")} className="ms-auto">
              {t("delete")}
            </ActionButton>
          ) : null}
        </div>
        {e.sign_status === "returned" && e.sign_note ? <p className="text-xs text-red-700">“{e.sign_note}”</p> : null}
      </div>
    </div>
  );
}
