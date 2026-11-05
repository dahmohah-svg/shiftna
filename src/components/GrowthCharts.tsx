"use client";

import { useState, type ReactNode } from "react";
import { formatNumber } from "@/lib/time";

/**
 * Small SVG charts for the admin growth dashboard, following the dataviz
 * guidelines: thin marks (<= 24px columns, 4px rounded tops, square at the
 * baseline, 2px gaps; 2px lines with ringed end dots), hairline solid grid,
 * one value axis, selective labels, and a hover / keyboard tooltip on every
 * mark. Colors: --color-viz-accent (the series that matters) and
 * --color-viz-context (the comparison), validated in light and dark mode.
 * Time runs left to right in both languages.
 */

/**
 * How chart values are written. Server components cannot pass a function to
 * these client charts, so they pass the locale and an optional template with
 * "{n}" where the number goes (for example "{n} h").
 */
export type ValueFormat = { locale: string; template?: string };

function formatter({ locale, template }: ValueFormat): (n: number) => string {
  return (n) => {
    const s = formatNumber(Math.round(n * 10) / 10, locale);
    return template ? template.replace("{n}", s) : s;
  };
}

export type Series = { name: string; color: "accent" | "context"; values: (number | null)[] };

const W = 340;
const H = 190;
const PAD = { top: 14, right: 12, bottom: 24, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const COLOR = { accent: "var(--color-viz-accent)", context: "var(--color-viz-context)" };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

/** Path for a column: 4px rounded top, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  const b = y + h;
  return `M${x},${b} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${b} Z`;
}

function Frame({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: { name: string; color: "accent" | "context" }[];
  children: ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-bold text-ink">{title}</span>
        {subtitle ? <span className="text-xs text-ink-muted">{subtitle}</span> : null}
      </figcaption>
      {legend && legend.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {legend.map((l) => (
            <li key={l.name} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[l.color] }} />
              {l.name}
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </figure>
  );
}

function Axis({ max, fmt }: { max: number; fmt: (n: number) => string }) {
  const ticks = [0, max / 2, max];
  return (
    <g aria-hidden>
      {ticks.map((t) => {
        const y = PAD.top + PLOT_H - (t / max) * PLOT_H;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--color-ink-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmt(t)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XLabels({ labels, step }: { labels: string[]; step: number }) {
  return (
    <g aria-hidden>
      {labels.map((l, i) =>
        i % Math.max(1, Math.ceil(labels.length / 6)) === 0 || i === labels.length - 1 ? (
          <text key={i} x={PAD.left + step * (i + 0.5)} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--color-ink-muted)">
            {l}
          </text>
        ) : null,
      )}
    </g>
  );
}

function Tooltip({ label, rows }: { label: string; rows: { name: string; value: string; color: "accent" | "context" }[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto w-max max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="pb-1 text-ink-muted">{label}</p>
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 rounded" style={{ background: COLOR[r.color] }} />
          <span className="font-bold text-ink">{r.value}</span>
          <span className="text-ink-muted">{r.name}</span>
        </p>
      ))}
    </div>
  );
}

/** Weekly columns, one or two series side by side. */
export function ColumnChart({
  title,
  subtitle,
  labels,
  series,
  format,
}: {
  title: string;
  subtitle?: string;
  labels: string[];
  series: Series[];
  format: ValueFormat;
}) {
  const fmt = formatter(format);
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const step = PLOT_W / labels.length;
  const gap = 2;
  const barW = Math.min(24, (step * 0.7 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const last = labels.length - 1;

  return (
    <Frame title={title} subtitle={subtitle} legend={series}>
      <div className="relative" dir="ltr" onPointerLeave={() => setActive(null)}>
        {active !== null ? (
          <Tooltip
            label={labels[active]}
            rows={series.map((s) => ({ name: s.name, value: s.values[active] == null ? "—" : fmt(s.values[active]!), color: s.color }))}
          />
        ) : null}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={title}>
          <Axis max={max} fmt={fmt} />
          {labels.map((l, i) => {
            const x0 = PAD.left + step * i + (step - groupW) / 2;
            return (
              <g
                key={i}
                tabIndex={0}
                role="img"
                aria-label={`${l}: ${series.map((s) => `${s.name} ${s.values[i] == null ? "—" : fmt(s.values[i]!)}`).join(", ")}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                {/* Hit target: the whole band, bigger than the bars. */}
                <rect x={PAD.left + step * i} y={PAD.top} width={step} height={PLOT_H} fill="transparent" />
                {series.map((s, k) => {
                  const v = s.values[i] ?? 0;
                  const h = (v / max) * PLOT_H;
                  if (h <= 0) return null;
                  return (
                    <path
                      key={s.name}
                      d={columnPath(x0 + k * (barW + gap), PAD.top + PLOT_H - h, barW, h)}
                      fill={COLOR[s.color]}
                      opacity={active === null || active === i ? 1 : 0.55}
                    />
                  );
                })}
              </g>
            );
          })}
          {/* Selective label: the latest week of the main series. */}
          {(() => {
            const main = series[series.length - 1];
            const v = main.values[last];
            if (v == null) return null;
            const k = series.length - 1;
            const x = PAD.left + step * last + (step - groupW) / 2 + k * (barW + gap) + barW / 2;
            const y = PAD.top + PLOT_H - (v / max) * PLOT_H - 4;
            return (
              <text x={x} y={Math.max(9, y)} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--color-ink)" aria-hidden>
                {fmt(v)}
              </text>
            );
          })()}
          <XLabels labels={labels} step={step} />
        </svg>
      </div>
    </Frame>
  );
}

/** A weekly line (single series): crosshair snaps to the nearest week. */
export function LineChart({
  title,
  subtitle,
  labels,
  values,
  format,
}: {
  title: string;
  subtitle?: string;
  labels: string[];
  values: (number | null)[];
  format: ValueFormat;
}) {
  const fmt = formatter(format);
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...values.map((v) => v ?? 0)));
  const step = PLOT_W / labels.length;
  const pt = (i: number, v: number) => [PAD.left + step * (i + 0.5), PAD.top + PLOT_H - (v / max) * PLOT_H] as const;
  const pts = values.map((v, i) => (v == null ? null : pt(i, v)));
  // Break the line where a week has no value.
  let d = "";
  pts.forEach((p, i) => {
    if (!p) return;
    d += `${i === 0 || !pts[i - 1] ? "M" : "L"}${p[0]},${p[1]} `;
  });
  const solid = pts.filter((p): p is readonly [number, number] => Boolean(p));
  const area =
    solid.length > 1 && pts.every(Boolean)
      ? `${d} L${solid[solid.length - 1][0]},${PAD.top + PLOT_H} L${solid[0][0]},${PAD.top + PLOT_H} Z`
      : "";
  const lastIdx = values.map((v, i) => (v == null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);

  return (
    <Frame title={title} subtitle={subtitle}>
      <div className="relative" dir="ltr" onPointerLeave={() => setActive(null)}>
        {active !== null ? (
          <Tooltip
            label={labels[active]}
            rows={[{ name: title, value: values[active] == null ? "—" : fmt(values[active]!), color: "accent" }]}
          />
        ) : null}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={title}>
          <Axis max={max} fmt={fmt} />
          {area ? <path d={area} fill={COLOR.accent} opacity={0.1} /> : null}
          <path d={d} fill="none" stroke={COLOR.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* Single weeks with no neighbours still show as dots. */}
          {pts.map((p, i) =>
            p && !pts[i - 1] && !pts[i + 1] ? <circle key={`s${i}`} cx={p[0]} cy={p[1]} r={3} fill={COLOR.accent} /> : null,
          )}
          {active !== null && pts[active] ? (
            <line x1={pts[active]![0]} x2={pts[active]![0]} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--color-ink-muted)" strokeWidth={1} aria-hidden />
          ) : null}
          {lastIdx >= 0 ? (
            <>
              <circle cx={pts[lastIdx]![0]} cy={pts[lastIdx]![1]} r={4} fill={COLOR.accent} stroke="var(--color-surface)" strokeWidth={2} />
              <text x={pts[lastIdx]![0] - 6} y={Math.max(9, pts[lastIdx]![1] - 8)} textAnchor="end" fontSize={9} fontWeight={700} fill="var(--color-ink)" aria-hidden>
                {fmt(values[lastIdx]!)}
              </text>
            </>
          ) : null}
          {active !== null && pts[active] && active !== lastIdx ? (
            <circle cx={pts[active]![0]} cy={pts[active]![1]} r={4} fill={COLOR.accent} stroke="var(--color-surface)" strokeWidth={2} aria-hidden />
          ) : null}
          {labels.map((l, i) => (
            <rect
              key={i}
              x={PAD.left + step * i}
              y={PAD.top}
              width={step}
              height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${l}: ${values[i] == null ? "—" : fmt(values[i]!)}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none"
            />
          ))}
          <XLabels labels={labels} step={step} />
        </svg>
      </div>
    </Frame>
  );
}

/** Ranked horizontal bars, one hue, value at the tip. */
export function RankedBars({
  title,
  subtitle,
  rows,
  format,
  empty,
}: {
  title: string;
  subtitle?: string;
  rows: { label: string; value: number }[];
  format: ValueFormat;
  empty: string;
}) {
  const fmt = formatter(format);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Frame title={title} subtitle={subtitle}>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex flex-col gap-1" title={`${r.label}: ${fmt(r.value)}`}>
              <div className="flex justify-between text-sm">
                <span className="text-ink">{r.label}</span>
                <span className="font-semibold text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmt(r.value)}
                </span>
              </div>
              <div className="h-3 rounded-e-[4px]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: COLOR.accent }} />
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
