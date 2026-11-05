import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

/**
 * "Syndicate verified": the doctor's Syndicate card, license and specialty
 * certificate are approved and not expired. `compact` shows only the shield
 * (with the full meaning for screen readers), for tight rows.
 */
export default function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Verified");
  if (compact) {
    return (
      <span title={t("full")} className="inline-flex shrink-0 text-emerald-700">
        <ShieldCheck className="h-4 w-4" aria-hidden strokeWidth={2.4} />
        <span className="sr-only">{t("full")}</span>
      </span>
    );
  }
  return (
    <span
      title={t("full")}
      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden strokeWidth={2.4} />
      {t("short")}
    </span>
  );
}
