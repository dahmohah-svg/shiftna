import { getTranslations } from "next-intl/server";
import { Medal, Sprout } from "lucide-react";
import { Badge } from "./ui";

/** New / Silver / Gold badge from the doctor_trust database function. "New" is calm, not a warning. */
export default async function TrustBadge({ badge }: { badge: string | null | undefined }) {
  const t = await getTranslations("Profile");
  if (badge === "gold")
    return (
      <Badge tone="gold">
        <Medal className="h-3.5 w-3.5" aria-hidden /> {t("badgeGold")}
      </Badge>
    );
  if (badge === "silver")
    return (
      <Badge tone="silver">
        <Medal className="h-3.5 w-3.5" aria-hidden /> {t("badgeSilver")}
      </Badge>
    );
  return (
    <Badge tone="brand">
      <Sprout className="h-3.5 w-3.5" aria-hidden /> {t("badgeNew")}
    </Badge>
  );
}
