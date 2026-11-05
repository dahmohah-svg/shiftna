"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Share2 } from "lucide-react";
import { buttonClass } from "./ui";

/** Share the install link (phone share sheet), or copy it. */
export default function ShareLink({ url }: { url: string }) {
  const t = useTranslations("Install");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("shareTitle"), text: t("shareText"), url });
        return;
      } catch {
        // Cancelled: copy instead.
      }
    }
    copy();
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={share} className={buttonClass.secondary}>
        <Share2 className="h-4 w-4" aria-hidden />
        {t("share")}
      </button>
      <button type="button" onClick={copy} className={buttonClass.secondary}>
        <Copy className="h-4 w-4" aria-hidden />
        {copied ? t("copied") : t("copyLink")}
      </button>
    </div>
  );
}
