import { useTranslations } from "next-intl";
import { BadgeCheck, CirclePause, ShieldQuestion } from "lucide-react";
import { Badge } from "./ui";

/** Verified team (checked by the Shiftna team), Unverified team, or Paused. */
export default function TeamStatusBadge({ verified, paused = false }: { verified: boolean; paused?: boolean }) {
  const t = useTranslations("Teams");
  if (paused)
    return (
      <Badge tone="danger">
        <CirclePause className="h-3.5 w-3.5" aria-hidden /> {t("paused")}
      </Badge>
    );
  if (verified)
    return (
      <Badge tone="success">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {t("verifiedTeam")}
      </Badge>
    );
  return (
    <Badge tone="warn">
      <ShieldQuestion className="h-3.5 w-3.5" aria-hidden /> {t("unverifiedTeam")}
    </Badge>
  );
}
