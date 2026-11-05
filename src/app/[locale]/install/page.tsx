import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import QRCode from "qrcode";
import { Link } from "@/i18n/navigation";
import { InstallPanel } from "@/components/InstallApp";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Logo from "@/components/Logo";
import ShareLink from "@/components/ShareLink";
import { Card } from "@/components/ui";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/install">) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Install" });
  return { title: t("pageTitle"), description: t("pageIntro") };
}

/**
 * shiftna.vercel.app/install: one short link to share in WhatsApp groups or
 * print as a QR code. It shows each visitor the right way to install.
 */
export default async function InstallPage({ params }: PageProps<"/[locale]/install">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Install");
  const c = await getTranslations("Common");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "shiftna.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  // The short link without a language, so everyone lands in their own.
  const url = `${proto}://${host}/install`;
  const qr = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0b1220", light: "#ffffff" },
  });

  const qrCard = (
    <div className="flex flex-col items-center gap-3">
      {/* Always dark on white so any phone camera can read it. */}
      <div
        className="w-52 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line [&_svg]:h-auto [&_svg]:w-full"
        role="img"
        aria-label={t("qrLabel")}
        dangerouslySetInnerHTML={{ __html: qr }}
      />
      <p dir="ltr" className="font-mono text-sm font-semibold text-ink">
        {url.replace(/^https?:\/\//, "")}
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between py-2">
        <Link href="/" aria-label={c("appName")}>
          <Logo size="sm" />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-col gap-6">
        <section className="flex flex-col items-center gap-3 pt-4 text-center">
          <Logo size="lg" />
          <h1 className="text-3xl font-extrabold text-ink">{t("pageTitle")}</h1>
          <p className="text-base leading-relaxed text-ink-muted">{t("pageIntro")}</p>
        </section>

        <Card className="flex flex-col gap-4">
          <InstallPanel
            desktop={<p className="text-center text-sm font-semibold">{t("onComputer")}</p>}
          />
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold">{t("shareHeading")}</h2>
            <p className="text-sm text-ink-muted">{t("shareIntro")}</p>
          </div>
          {qrCard}
          <ShareLink url={url} />
        </Card>
      </main>
    </div>
  );
}
