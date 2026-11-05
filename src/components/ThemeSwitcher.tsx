"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const KEY = "shiftna-theme";
const EVENT = "shiftna:theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Automatic (follows the phone), Light or Dark. Saved on this phone only. */
export default function ThemeSwitcher() {
  const t = useTranslations("Theme");
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  const choose = (v: Theme) => {
    try {
      if (v === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, v);
    } catch {
      // Private mode: the choice lasts until the page is closed.
    }
    // The script in the layout listens for this and repaints at once.
    window.dispatchEvent(new Event(EVENT));
  };

  const options = [
    { v: "system" as const, Icon: Monitor },
    { v: "light" as const, Icon: Sun },
    { v: "dark" as const, Icon: Moon },
  ];

  return (
    <div role="radiogroup" aria-label={t("label")} className="grid grid-cols-3 gap-1 rounded-xl bg-line/50 p-1">
      {options.map(({ v, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={theme === v}
          onClick={() => choose(v)}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${theme === v ? "bg-surface text-brand-700 shadow-sm" : "text-ink-muted"}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {t(v)}
        </button>
      ))}
    </div>
  );
}
