"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/time";
import { Check, Circle, MessageCircle, Share2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "./ui";

const INVITED_KEY = "shiftna-invited";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    readFlag("shiftna-installed")
  );
}

type StepKey = "install" | "team" | "post" | "alert" | "invite";
type Step = { key: StepKey; href: string; done: boolean };

/**
 * Getting-started checklist. Server-known steps arrive done or not; installing
 * the app and inviting colleagues are only known on this phone.
 */
export function HomeChecklist({ steps }: { steps: Step[] }) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const [installed, setInstalled] = useState(false);
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    // Read once on the phone; these can't be known on the server.
    const sync = () => {
      setInstalled(isInstalled());
      setInvited(readFlag(INVITED_KEY));
    };
    sync();
    window.addEventListener("shiftna:invited", sync);
    return () => window.removeEventListener("shiftna:invited", sync);
  }, []);
  const all: Step[] = [
    { key: "install", href: "/install", done: installed },
    ...steps,
    { key: "invite", href: "#invite", done: invited },
  ];
  const done = all.filter((s) => s.done).length;
  if (done === all.length) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="start-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="start-title" className="text-lg font-bold">{t("startTitle")}</h2>
        <span className="text-sm font-semibold text-brand-700">{t("progress", { done: formatNumber(done, locale), total: formatNumber(all.length, locale) })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-page" aria-hidden>
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(100 * done) / all.length}%` }} />
      </div>
      <ul className="flex flex-col">
        {all.map((s) => (
          <li key={s.key} className="border-b border-line last:border-b-0">
            <Link href={s.href} className="flex items-center gap-3 py-2.5">
              {s.done ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
              ) : (
                <Circle className="h-6 w-6 shrink-0 text-line" aria-hidden />
              )}
              <span className="flex min-w-0 flex-col">
                <span className={`font-semibold ${s.done ? "text-ink-muted line-through" : "text-ink"}`}>{t(`step.${s.key}`)}</span>
                {!s.done ? <span className="text-xs text-ink-muted">{t(`stepHint.${s.key}`)}</span> : null}
              </span>
              <span className="sr-only">{s.done ? t("done") : t("todo")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Invite colleagues on WhatsApp or through the phone's share sheet. */
export function InviteCard({ url }: { url: string }) {
  const t = useTranslations("Dashboard");
  const text = t("inviteMessage", { url });
  const mark = () => {
    try {
      localStorage.setItem(INVITED_KEY, "1");
    } catch {
      // Private mode: nothing to remember.
    }
    window.dispatchEvent(new Event("shiftna:invited"));
  };
  const share = async () => {
    mark();
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // Cancelled.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard not available.
    }
  };
  return (
    <section id="invite" className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4" aria-labelledby="invite-title">
      <div>
        <h2 id="invite-title" className="text-lg font-bold text-ink">{t("inviteTitle")}</h2>
        <p className="text-sm text-ink-muted">{t("inviteBody")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={mark}
          className={buttonClass.primary}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t("whatsapp")}
        </a>
        <button type="button" onClick={share} className={buttonClass.secondary}>
          <Share2 className="h-4 w-4" aria-hidden />
          {t("share")}
        </button>
      </div>
    </section>
  );
}
