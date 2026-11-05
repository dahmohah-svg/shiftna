import { useTranslations } from "next-intl";

export default function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const t = useTranslations("Common");
  const box = size === "lg" ? "h-16 w-16 rounded-2xl" : "h-8 w-8 rounded-lg";
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={`flex ${box} items-center justify-center shadow-md shadow-brand-600/30`}
        style={{ background: "linear-gradient(135deg, #14b8a6, #0f766e)" }}
      >
        {/* A clock whose hand becomes a heartbeat: medical shifts. */}
        <svg viewBox="0 0 512 512" className="h-full w-full">
          <g fill="none" stroke="#fff" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round">
            <path d="M392 196 A150 150 0 1 0 392 316" />
            <path d="M244 162 V262 H290 L314 208 L344 316 L368 262 H430" />
          </g>
        </svg>
      </span>
      {size === "sm" ? (
        <span className="text-xl font-bold text-brand-700">{t("appName")}</span>
      ) : null}
    </span>
  );
}
