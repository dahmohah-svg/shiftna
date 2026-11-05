"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/time";
import { Bell, ClipboardList, Handshake, SquarePlus, UserRound } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeAsUser } from "@/lib/supabase/realtime";

const tabs = [
  { href: "/shifts", key: "shifts", Icon: ClipboardList },
  { href: "/post", key: "post", Icon: SquarePlus },
  { href: "/activity", key: "activity", Icon: Handshake },
  { href: "/notifications", key: "alerts", Icon: Bell },
  { href: "/profile", key: "profile", Icon: UserRound },
] as const;

/** Sent by the notifications page once it has marked everything read. */
export const NOTIFICATIONS_READ_EVENT = "shiftna:notifications-read";

/** Bottom tab bar: Shifts, Post, Offers, Alerts, Profile. */
export default function TabBar({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);

  // New notifications arrive live.
  useEffect(() => {
    return subscribeAsUser(createClient(), (supabase) =>
      supabase.channel(`notifications-${userId}`).on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => setUnread((n) => n + 1),
      ),
    );
  }, [userId]);

  // Re-count when moving between screens, and clear when they are read.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .then(({ count }) => {
        if (!cancelled && count !== null) setUnread(count);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, userId]);

  useEffect(() => {
    const clear = () => setUnread(0);
    window.addEventListener(NOTIFICATIONS_READ_EVENT, clear);
    return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, clear);
  }, []);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href ||
            pathname.startsWith(tab.href + "/") ||
            (tab.href === "/activity" && pathname.startsWith("/bookings")) ||
            (tab.href === "/profile" && ["/doctors", "/admin", "/teams"].some((p) => pathname.startsWith(p)));
          const badge = tab.key === "alerts" && unread > 0 ? unread : 0;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={badge ? t("alertsUnread", { count: badge, n: formatNumber(badge, locale) }) : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active ? "text-brand-700" : "text-ink-muted"}`}
              >
                <span className="relative">
                  <tab.Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {badge ? (
                    <span
                      aria-hidden
                      className="absolute -top-1.5 -end-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] leading-none font-bold text-white"
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
