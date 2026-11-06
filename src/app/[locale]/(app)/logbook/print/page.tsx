import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import PrintButton from "@/components/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { requireDoctor } from "@/lib/viewer";
import { LOGBOOK_COLUMNS, logbookNames, type LogbookEntry } from "@/lib/logbook";
import type { Specialty } from "@/lib/constants";
import { formatDate, formatDateTime, formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

/** The logbook as a printable training record (or PDF). */
export default async function LogbookPrintPage({ params, searchParams }: PageProps<"/[locale]/logbook/print">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireDoctor(locale);
  const sp = await searchParams;
  const signedOnly = sp.signed === "1";
  const t = await getTranslations("Logbook");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const n = (x: number) => formatNumber(x, locale);
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("logbook_entries")
    .select(LOGBOOK_COLUMNS)
    .eq("user_id", viewer.userId)
    .order("entry_date", { ascending: true })
    .limit(1000);
  let entries = (rows ?? []) as unknown as LogbookEntry[];
  if (signedOnly) entries = entries.filter((e) => e.verified || e.sign_status === "signed");
  const names = await logbookNames(supabase, entries);
  const p = viewer.profile;

  return (
    <div className="flex flex-col gap-3">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/logbook" className="text-sm font-semibold text-brand-700">
          <span aria-hidden className="inline-block rtl:rotate-180">←</span> {c("back")}
        </Link>
        <Link href={signedOnly ? "/logbook/print" : "/logbook/print?signed=1"} className="text-sm font-semibold text-brand-700 underline">
          {signedOnly ? t("printAll") : t("printSigned")}
        </Link>
        <PrintButton label={t("printNow")} />
      </div>
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-extrabold">{t("printTitle")}</h1>
        <p className="font-semibold">{p.full_name}</p>
        <p className="text-sm text-ink-muted">
          {o(`specialty.${p.specialty as Specialty}`)}
          {p.grade ? ` · ${o(`grade.${p.grade as "resident"}`)}` : null}
        </p>
        <p className="text-xs text-ink-muted">{t("printedOn", { when: formatDateTime(new Date().toISOString(), locale) })}</p>
      </header>
      <table className="w-full border-collapse text-xs print:text-[10px]">
        <thead>
          <tr>
            {[t("date"), t("procedure"), t("role"), t("cases"), t("signature")].map((h) => (
              <th key={h} className="border border-line bg-page p-1.5 text-start">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="break-inside-avoid align-top">
              <td className="border border-line p-1.5 whitespace-nowrap">{formatDate(e.entry_date, locale)}</td>
              <td className="border border-line p-1.5">
                <span className="font-semibold">{e.procedure ?? (e.booking_id ? t("shiftEntry") : o(`subspecialty.${e.subspecialty as "general"}`))}</span>
                <span className="block text-ink-muted">
                  {o(`subspecialty.${e.subspecialty as "general"}`)}
                  {e.hospital?.name ?? e.hospital_name ? ` · ${e.hospital?.name ?? e.hospital_name}` : null}
                  {e.hours ? ` · ${t("hoursN", { n: n(e.hours) })}` : null}
                </span>
              </td>
              <td className="border border-line p-1.5">{e.role ? t(`roles.${e.role as "performed"}`) : "—"}</td>
              <td className="border border-line p-1.5 text-center">{e.cases_count ? n(e.cases_count) : "—"}</td>
              <td className="border border-line p-1.5">
                {e.verified
                  ? t("verifiedShift")
                  : e.sign_status === "signed"
                    ? (() => {
                        const s = e.signed_by ? names.person.get(e.signed_by) : undefined;
                        return `${s?.full_name ?? "—"}${s?.grade ? ` (${o(`grade.${s.grade as "consultant"}`)})` : ""} · ${formatDate(e.signed_at!, locale)}`;
                      })()
                    : t("notSigned")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-ink-muted">{t("printFooter")}</p>
    </div>
  );
}
