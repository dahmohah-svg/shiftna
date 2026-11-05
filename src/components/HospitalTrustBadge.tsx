import { useTranslations } from "next-intl";
import type { TrustLevel } from "@/lib/hospitals";
import { Badge } from "./ui";

const TONE = { verified: "success", trusted: "brand", active: "neutral", new: "warn" } as const;

/** Hospital credibility: Verified, Trusted, Active or New. */
export default function HospitalTrustBadge({ level }: { level: TrustLevel }) {
  const t = useTranslations("Hospitals");
  return (
    <Badge tone={TONE[level]}>
      {level === "verified" ? "✓ " : ""}
      {t(`level.${level}`)}
    </Badge>
  );
}
