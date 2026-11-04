import { useTranslations } from "next-intl";

export default function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const t = useTranslations("Common");
  const box = size === "lg" ? "h-16 w-16 rounded-2xl" : "h-8 w-8 rounded-lg";
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={`flex ${box} items-center justify-center bg-brand-600 shadow-md shadow-brand-600/30`}
      >
        <svg viewBox="0 0 512 512" className="h-3/4 w-3/4">
          <circle cx="256" cy="256" r="150" fill="none" stroke="#fff" strokeWidth="40" />
          <path d="M256 140v116l78 52" fill="none" stroke="#fff" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {size === "sm" ? (
        <span className="text-xl font-bold text-brand-700">{t("appName")}</span>
      ) : null}
    </span>
  );
}
