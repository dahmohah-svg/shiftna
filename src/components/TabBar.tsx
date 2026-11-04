"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const tabs = [
  { href: "/shifts", key: "shifts", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/post", key: "post", icon: "M12 5v14M5 12h14" },
  { href: "/activity", key: "activity", icon: "M5 13l4 4L19 7" },
  { href: "/profile", key: "profile", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0" },
] as const;

/** Bottom tab bar: Shifts, Post, Offers, Profile. */
export default function TabBar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href ||
            pathname.startsWith(tab.href + "/") ||
            (tab.href === "/activity" && pathname.startsWith("/bookings")) ||
            (tab.href === "/profile" && (pathname.startsWith("/doctors") || pathname.startsWith("/admin")));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active ? "text-brand-700" : "text-ink-muted"}`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={tab.icon} />
                </svg>
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
