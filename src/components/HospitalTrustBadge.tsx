import { useTranslations } from "next-intl";
import { BadgeCheck, Building2, Sparkles, TrendingUp } from "lucide-react";
import type { TrustLevel } from "@/lib/hospitals";
import { Badge } from "./ui";

const TONE = { verified: "success", trusted: "brand", active: "neutral", new: "warn" } as const;
const ICON = { verified: BadgeCheck, trusted: TrendingUp, active: Building2, new: Sparkles } as const;

/** Hospital credibility: Verified, Trusted, Active or New. */
export default function HospitalTrustBadge({ level }: { level: TrustLevel }) {
  const t = useTranslations("Hospitals");
  const Icon = ICON[level];
  return (
    <Badge tone={TONE[level]}>
      <Icon className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
      {t(`level.${level}`)}
    </Badge>
  );
}
