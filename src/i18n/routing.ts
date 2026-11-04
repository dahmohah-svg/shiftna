import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Arabic first: it is the default language of Shiftna.
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Every URL carries its language: /ar/... or /en/...
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** Right-to-left languages. */
export const rtlLocales: readonly Locale[] = ["ar"];

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}
