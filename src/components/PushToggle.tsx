"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BellOff, BellRing } from "lucide-react";
import { deletePushSubscription, savePushSubscription } from "@/app/actions/push";
import { vapidKeyBytes } from "@/lib/push";
import { buttonClass } from "./ui";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function detect(): Promise<State> | State {
  if (typeof window === "undefined") return "loading";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !standalone ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return navigator.serviceWorker.ready
    .then((reg) => reg.pushManager.getSubscription())
    .then((sub) => (sub && Notification.permission === "granted" ? "on" : "off"));
}

/**
 * Turn phone notifications on or off. "card" is the prompt on the home page
 * (hidden once on); "row" is the setting in Profile.
 */
export default function PushToggle({ variant = "row" }: { variant?: "card" | "row" }) {
  const t = useTranslations("Push");
  const locale = useLocale();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.resolve(detect()).then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setFailed(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes() }));
      const res = await savePushSubscription(sub.toJSON(), locale);
      if (!res.ok) throw new Error("save");
      setState("on");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || (variant === "card" && (state === "on" || state === "unsupported"))) return null;

  const note =
    state === "ios-install" ? t("iosInstall") : state === "denied" ? t("denied") : state === "unsupported" ? t("unsupported") : null;

  const button =
    state === "on" ? (
      <button type="button" onClick={turnOff} disabled={busy} className={`${buttonClass.secondary} shrink-0`}>
        <BellOff className="h-4 w-4" aria-hidden /> {t("turnOff")}
      </button>
    ) : state === "off" ? (
      <button type="button" onClick={turnOn} disabled={busy} className={`${buttonClass.primary} shrink-0`}>
        <BellRing className="h-4 w-4" aria-hidden /> {t("turnOn")}
      </button>
    ) : null;

  if (variant === "card") {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <BellRing className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="font-bold text-ink">{t("cardTitle")}</h2>
            <p className="text-sm leading-relaxed text-ink-muted">{note ?? t("cardBody")}</p>
          </div>
        </div>
        {button}
        {failed ? <p className="text-sm text-red-700">{t("failed")}</p> : null}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{t("title")}</span>
          <span className="text-xs text-ink-muted">{note ?? (state === "on" ? t("onNote") : t("offNote"))}</span>
        </div>
        {button}
      </div>
      {failed ? <p className="text-sm text-red-700">{t("failed")}</p> : null}
    </div>
  );
}
