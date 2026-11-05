import { getTranslations, getLocale } from "next-intl/server";
import { Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge, EmptyState } from "./ui";
import type { JobOffer } from "@/lib/jobs";
import { formatDateTime } from "@/lib/time";

const STATUS_TONE = { pending: "warn", accepted: "success", declined: "neutral", withdrawn: "neutral" } as const;

/** Job offers sent by hospital HR, as a list of links to each offer. */
export default async function JobOfferList({ offers, me }: { offers: JobOffer[]; me: string }) {
  const t = await getTranslations("Jobs");
  const o = await getTranslations("Options");
  const locale = await getLocale();
  if (offers.length === 0) return <EmptyState>{t("none")}</EmptyState>;
  return (
    <ul className="flex flex-col gap-2">
      {offers.map((j) => {
        const sent = j.hr_id === me;
        return (
          <li key={j.id}>
            <Link
              href={`/jobs/${j.id}`}
              className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <span className="flex min-w-0 items-start gap-3">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Building2 className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-bold">{j.title}</span>
                  <span className="truncate text-sm text-ink-muted">
                    {sent ? t("to", { doctor: j.doctor?.full_name ?? "—" }) : j.hospital?.name}
                    {" · "}
                    {o(`jobKind.${j.kind as "shift"}`)}
                  </span>
                  <span className="text-xs text-ink-muted">{formatDateTime(j.created_at, locale)}</span>
                </span>
              </span>
              <Badge tone={STATUS_TONE[j.status]}>{o(`jobStatus.${j.status}`)}</Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
