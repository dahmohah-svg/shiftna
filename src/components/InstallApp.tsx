"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { buttonClass } from "./ui";

/**
 * "Install Shiftna" for phones.
 * - Android browsers that support it: one tap opens the phone's own install prompt.
 * - iPhone, and Android browsers without a prompt: short illustrated steps.
 * - In-app browsers (WhatsApp, Facebook, Instagram…) cannot install apps:
 *   the steps say to open the page in Safari or Chrome first.
 * Hidden when Shiftna is already installed or opened from its home-screen icon.
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type Mode = "hidden" | "prompt" | "ios" | "android" | "inapp";

declare global {
  interface Window {
    __shiftnaInstall?: InstallEvent | null;
  }
}

const DISMISS_KEY = "shiftna-install-dismissed";
const DISMISS_DAYS = 14;

function detect(): { mode: Mode; mobile: boolean; ios: boolean } {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const mobile = ios || android;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return { mode: "hidden", mobile, ios };
  if (window.__shiftnaInstall) return { mode: "prompt", mobile, ios };
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|WhatsApp|; wv\)/i.test(ua);
  if (mobile && inApp) return { mode: "inapp", mobile, ios };
  if (ios) return { mode: "ios", mobile, ios };
  if (android) return { mode: "android", mobile, ios };
  return { mode: "hidden", mobile, ios };
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function useInstall() {
  const [state, setState] = useState<{ mode: Mode; ios: boolean; dismissed: boolean }>({
    mode: "hidden",
    ios: false,
    dismissed: true,
  });

  useEffect(() => {
    const update = () => {
      const d = detect();
      setState({ mode: d.mode, ios: d.ios, dismissed: dismissedRecently() });
    };
    update();
    const installed = () => setState((s) => ({ ...s, mode: "hidden" }));
    window.addEventListener("shiftna:installable", update);
    window.addEventListener("shiftna:installed", installed);
    return () => {
      window.removeEventListener("shiftna:installable", update);
      window.removeEventListener("shiftna:installed", installed);
    };
  }, []);

  /** Returns true when the phone's own prompt was shown. */
  const promptInstall = useCallback(async () => {
    const e = window.__shiftnaInstall;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    window.__shiftnaInstall = null;
    if (outcome === "accepted") setState((s) => ({ ...s, mode: "hidden" }));
    return true;
  }, []);

  return { ...state, promptInstall };
}

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
);
const PlusSquareIcon = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const DotsIcon = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

function Steps({ mode, ios, onClose }: { mode: Mode; ios: boolean; onClose: () => void }) {
  const t = useTranslations("Install");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const steps =
    mode === "ios"
      ? [
          <>{t.rich("iosStep1", { icon: () => <ShareIcon /> })}</>,
          <>{t.rich("iosStep2", { icon: () => <PlusSquareIcon /> })}</>,
          <>{t("iosStep3")}</>,
        ]
      : mode === "android"
        ? [<>{t.rich("androidStep1", { icon: () => <DotsIcon /> })}</>, <>{t("androidStep2")}</>, <>{t("androidStep3")}</>]
        : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={onClose}>
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="install-title" className="text-lg font-bold">
          {t("stepsTitle")}
        </h2>
        {mode === "inapp" ? (
          <>
            <p className="text-sm leading-relaxed">{ios ? t("inAppIos") : t("inAppAndroid")}</p>
            <button type="button" onClick={copy} className={buttonClass.secondary}>
              {copied ? t("copied") : t("copyLink")}
            </button>
          </>
        ) : (
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">
                  {(i + 1).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}
                </span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-ink-muted">{t("afterInstall")}</p>
        <button type="button" onClick={onClose} className={buttonClass.primary}>
          {t("gotIt")}
        </button>
      </div>
    </div>
  );
}

export default function InstallApp({ variant }: { variant: "banner" | "button" }) {
  const t = useTranslations("Install");
  const { mode, ios, dismissed: dismissedBefore, promptInstall } = useInstall();
  const [showSteps, setShowSteps] = useState(false);
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissed = dismissedBefore || dismissedNow;

  if (mode === "hidden") return null;
  if (variant === "banner" && dismissed) return null;

  const onInstall = async () => {
    if (mode === "prompt" && (await promptInstall())) return;
    setShowSteps(true);
  };
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private mode: hide for this visit only.
    }
    setDismissedNow(true);
  };

  const steps = showSteps ? <Steps mode={mode} ios={ios} onClose={() => setShowSteps(false)} /> : null;

  if (variant === "button") {
    return (
      <>
        <button type="button" onClick={onInstall} className={`${buttonClass.secondary} w-full`}>
          <DownloadIcon />
          {t("button")}
        </button>
        {steps}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-3">
        <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-bold text-ink">{t("bannerTitle")}</span>
          <span className="text-xs text-ink-muted">{t("bannerText")}</span>
        </div>
        <button type="button" onClick={onInstall} className={`${buttonClass.primary} min-h-9 shrink-0 px-3 py-1.5 text-sm`}>
          {t("install")}
        </button>
        <button type="button" onClick={dismiss} aria-label={t("notNow")} className="shrink-0 rounded-lg p-1.5 text-ink-muted hover:bg-line/50">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {steps}
    </>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}
