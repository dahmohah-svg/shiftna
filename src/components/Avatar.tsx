/** A doctor's photo, or their initials on a colour picked from their name. */
const COLORS = ["#0f766e", "#0369a1", "#7c3aed", "#b45309", "#be123c", "#4d7c0f", "#a21caf", "#334155"];

function initials(name: string): string {
  const parts = name
    .replace(/^(د\.|dr\.?|أ\.)\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "؟";
}

export default function Avatar({
  name,
  url,
  size = 40,
  className = "",
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small user photo from Supabase Storage
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={`shrink-0 rounded-full object-cover ring-1 ring-line ${className}`}
        style={style}
      />
    );
  }
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ ...style, background: COLORS[h % COLORS.length] }}
    >
      {initials(name)}
    </span>
  );
}
