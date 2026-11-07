import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Cairo } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, getDirection, type Locale } from "@/i18n/routing";
import Toaster from "@/components/Toaster";
import "../globals.css";

// Cairo covers both Arabic and Latin letters, so one font serves both languages.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  return {
    title: t("title"),
    description: t("description"),
    applicationName: t("title"),
    appleWebApp: { capable: true, title: t("title"), statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d9488" },
    { media: "(prefers-color-scheme: dark)", color: "#0a111d" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${cairo.variable} h-full antialiased`}
      // The theme script below sets data-theme before React loads.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* Light or dark before anything paints: the doctor's choice from
            Profile, otherwise the phone's setting. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var r=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var t='system';try{t=localStorage.getItem('shiftna-theme')||'system'}catch(e){}r.dataset.theme=t==='dark'||(t==='system'&&m.matches)?'dark':'light'}a();m.addEventListener('change',a);window.addEventListener('shiftna:theme',a)})();",
          }}
        />
        {/* Android announces "this app can be installed" very early; keep that
            event so the Install button can use it once the page is ready. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__shiftnaInstall=e;window.dispatchEvent(new Event('shiftna:installable'))});window.addEventListener('appinstalled',function(){window.__shiftnaInstall=null;try{localStorage.setItem('shiftna-installed','1')}catch(e){}window.dispatchEvent(new Event('shiftna:installed'))});",
          }}
        />
        {/* Service worker for phone notifications (it caches nothing). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
