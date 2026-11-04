import { getTranslations } from "next-intl/server";
import { Badge } from "./ui";

/** New / Silver / Gold badge from the doctor_trust database function. "New" is calm, not a warning. */
export default async function TrustBadge({ badge }: { badge: string | null | undefined }) {
  const t = await getTranslations("Profile");
  if (badge === "gold") return <Badge tone="gold">★ {t("badgeGold")}</Badge>;
  if (badge === "silver") return <Badge tone="silver">★ {t("badgeSilver")}</Badge>;
  return <Badge tone="brand">{t("badgeNew")}</Badge>;
}
