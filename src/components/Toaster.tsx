"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck } from "lucide-react";

const COOKIE = "shiftna-flash";

function takeFlash(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)shiftna-flash=([^;]+)/);
  if (!m) return null;
  document.cookie = `${COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  return decodeURIComponent(m[1]);
}

/**
 * Short confirmation at the top of the screen after an action ("Offer sent",
 * "Booking confirmed"…). Server actions leave a one-time cookie (lib/flash);
 * this picks it up, also after a redirect, and hides itself after 3.5 seconds.
 */
export default function Toaster() {
  const t = useTranslations("Toast");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    // Server actions answer without a page load, so check for a new message
    // a few times a second. Reading one cookie is very cheap.
    const check = () => {
      const k = takeFlash();
      if (k) setKey(k);
    };
    check();
    const id = window.setInterval(check, 400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!key) return;
    const id = window.setTimeout(() => setKey(null), 3500);
    return () => window.clearTimeout(id);
  }, [key]);

  type ToastKey = Parameters<typeof t>[0];
  const text = key && t.has(key as ToastKey) ? t(key as ToastKey) : null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      {text ? (
        <button
          type="button"
          onClick={() => setKey(null)}
          className="pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-2xl border border-emerald-200 bg-surface px-4 py-3 text-start text-sm font-semibold text-ink shadow-lg shadow-black/10 motion-safe:animate-[toast-in_200ms_ease-out]"
        >
          <CircleCheck className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          {text}
        </button>
      ) : null}
    </div>
  );
}
