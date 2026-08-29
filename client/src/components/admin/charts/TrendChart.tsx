"use client";

import { useId, useMemo, useState } from "react";

/**
 * The admin portal's charts. Hand-rolled SVG rather than a charting library,
 * for the same reason `lib/csvExport.ts` is hand-rolled: this app deliberately
 * carries no chart/form/state library.
 *
 * Design rules, so every chart in the portal reads the same way:
 *
 * - **Colour is `currentColor`.** Each series carries a Tailwind *text* class
 *   built from a theme token, and every shape inherits it. That keeps
 *   gradients, lines and swatches in sync from one declaration and lets the
 *   whole chart invert with dark mode.
 * - **Numbers are tabular.** Axis ticks, tooltips and legend values all use
 *   `tabular-nums` so digits stop jittering and columns line up.
 * - **One hover target per period**, spanning the full plot height — so the
 *   tooltip is easy to hit on a dense 30-day range instead of requiring the
 *   pointer to land on a 4px bar.
 * - **Axis labels are humanised** (`2026-03-09` → `9 Mar`), because the raw
 *   `$dateToString` bucket keys the API returns are unreadable on an axis.
 */

export interface ChartSeries {
  key: string;
  label: string;
  /** Tailwind *text* colour class from a theme token, e.g. "text-green-900". */
  colorClass: string;
  values: number[];
}

export type ChartGroupBy = "day" | "week" | "month";

/** Short money label for an axis — "৳1.2m" / "৳12k" / "৳950". */
export function compactBDT(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}৳${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  if (abs >= 1_000) return `${sign}৳${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}৳${Math.round(abs)}`;
}

function compactCount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

/** Exact figure for tooltips — the axis gets the short form, the tooltip the real number. */
function exactBDT(amount: number): string {
  return `${amount < 0 ? "-" : ""}৳${Math.abs(Math.round(amount)).toLocaleString("en-US")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Turns an API bucket key into something a person can read on an axis.
 * Day buckets are `YYYY-MM-DD`, week buckets `GGGG-Www`, month buckets
 * `YYYY-MM` — see `report.service.ts#dateBucketFormat`.
 */
export function formatPeriod(period: string, groupBy: ChartGroupBy, long = false): string {
  // Callers pass API bucket keys, but also user-facing range bounds that may
  // not be set yet. Bail out rather than emitting "NaN undefined".
  if (!period) return "";
  if (groupBy === "month") {
    const [year, month] = period.split("-");
    const name = MONTHS[Number(month) - 1] ?? month;
    return long ? `${name} ${year}` : name;
  }
  if (groupBy === "week") {
    const [year, week] = period.split("-W");
    return long ? `Week ${week}, ${year}` : `W${week}`;
  }
  const [year, month, day] = period.split("-");
  const name = MONTHS[Number(month) - 1] ?? month;
  return long ? `${Number(day)} ${name} ${year}` : `${Number(day)} ${name}`;
}

/** Keeps the x-axis readable when a range has more periods than will fit. */
function labelStride(count: number): number {
  if (count <= 8) return 1;
  if (count <= 16) return 2;
  if (count <= 32) return 4;
  return Math.ceil(count / 8);
}

/** "Nice" axis bound, so gridlines land on round numbers. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

const VIEW_W = 1000;
const VIEW_H = 380;
const PAD = { top: 20, right: 16, bottom: 44, left: 76 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

/**
 * Grouped bars (multi-series comparisons) or a filled area line (a single
 * trend). Negative values drop below a solid zero baseline, so a loss period
 * is unmistakable.
 */
export function TrendChart({
  periods,
  series,
  groupBy,
  variant = "bar",
  valueKind = "money",
  emptyMessage = "No data for this period.",
}: {
  periods: string[];
  series: ChartSeries[];
  groupBy: ChartGroupBy;
  /** "area" reads better for one series over many points; "bar" for comparisons. */
  variant?: "bar" | "area";
  valueKind?: "money" | "count";
  emptyMessage?: string;
}) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const axisFormat = valueKind === "money" ? compactBDT : compactCount;
  const exactFormat = valueKind === "money" ? exactBDT : (v: number) => Math.round(v).toLocaleString("en-US");

  const scale = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const rawMax = Math.max(0, ...all);
    const rawMin = Math.min(0, ...all);
    const max = niceCeiling(rawMax);
    const min = rawMin < 0 ? -niceCeiling(Math.abs(rawMin)) : 0;
    return { max, min, span: max - min || 1 };
  }, [series]);

  if (periods.length === 0 || series.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-brown-600/20 bg-cream-50">
        <p className="text-sm text-brown-500">{emptyMessage}</p>
      </div>
    );
  }

  // An area needs at least three points to read as a trend; with one or two
  // it degenerates into a filled block that says nothing. Bars are honest at
  // any count, so short ranges fall back to them.
  const shape = variant === "area" && periods.length >= 3 ? "area" : "bar";

  const yFor = (v: number) => PAD.top + ((scale.max - v) / scale.span) * PLOT_H;
  const zeroY = yFor(0);
  const slot = PLOT_W / periods.length;
  const stride = labelStride(periods.length);

  // Counts are whole things — an axis reading "0, 0, 1, 1, 1" (five ticks
  // squeezed into a range of 1, each rounded for display) is worse than two
  // honest ones, so a count axis is de-duplicated to integers.
  const rawTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => scale.min + scale.span * t);
  const ticks =
    valueKind === "count" ? [...new Set(rawTicks.map((v) => Math.round(v)))] : rawTicks;

  // Grouped bars share a slot, leaving a quarter of it as breathing room.
  const barW = Math.max(3, (slot * 0.7) / series.length);

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-[300px] w-full sm:h-[340px]"
          role="img"
          aria-label={`${series.map((s) => s.label).join(", ")} by period`}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} className={s.colorClass} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} className={s.colorClass} />
              </linearGradient>
            ))}
          </defs>

          {/* Gridlines + value axis */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={VIEW_W - PAD.right}
                y1={yFor(tick)}
                y2={yFor(tick)}
                className="stroke-brown-600/12"
                strokeWidth={1}
                strokeDasharray="4 5"
              />
              <text
                x={PAD.left - 14}
                y={yFor(tick) + 4}
                textAnchor="end"
                className="fill-brown-500 text-[13px] tabular-nums"
              >
                {axisFormat(tick)}
              </text>
            </g>
          ))}

          {/* Solid zero baseline — a bar below it reads immediately as a loss. */}
          <line
            x1={PAD.left}
            x2={VIEW_W - PAD.right}
            y1={zeroY}
            y2={zeroY}
            className="stroke-brown-600/35"
            strokeWidth={1.5}
          />

          {/* Highlight band behind the hovered period */}
          {activeIndex !== null && (
            <rect
              x={PAD.left + activeIndex * slot}
              y={PAD.top}
              width={slot}
              height={PLOT_H}
              className="fill-green-950/5"
            />
          )}

          {shape === "area"
            ? series.map((s, si) => {
                const points = s.values.map((v, i) => [PAD.left + slot * (i + 0.5), yFor(v)] as const);
                const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
                const area =
                  `M${points[0][0]},${zeroY} ` +
                  points.map(([x, y]) => `L${x},${y}`).join(" ") +
                  ` L${points[points.length - 1][0]},${zeroY} Z`;
                return (
                  <g key={s.key} className={s.colorClass}>
                    <path d={area} fill={`url(#${gradientId}-${si})`} />
                    <path
                      d={line}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {points.map(([x, y], i) => (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={activeIndex === i ? 5 : 0}
                        fill="currentColor"
                        stroke="var(--color-surface)"
                        strokeWidth={2}
                      />
                    ))}
                  </g>
                );
              })
            : periods.map((period, i) => {
                const groupX = PAD.left + i * slot + (slot - barW * series.length) / 2;
                return (
                  <g key={period}>
                    {series.map((s, si) => {
                      const v = s.values[i] ?? 0;
                      const y = v >= 0 ? yFor(v) : zeroY;
                      const h = Math.max(2, Math.abs(yFor(v) - zeroY));
                      return (
                        <rect
                          key={s.key}
                          x={groupX + si * barW}
                          y={y}
                          width={Math.max(2, barW - 2)}
                          height={h}
                          rx={2.5}
                          fill="currentColor"
                          className={`${s.colorClass} transition-opacity ${
                            activeIndex === null || activeIndex === i ? "opacity-100" : "opacity-40"
                          }`}
                        />
                      );
                    })}
                  </g>
                );
              })}

          {/* Period axis */}
          {periods.map((period, i) =>
            i % stride === 0 ? (
              <text
                key={period}
                x={PAD.left + i * slot + slot / 2}
                y={VIEW_H - PAD.bottom + 24}
                textAnchor="middle"
                className="fill-brown-500 text-[13px]"
              >
                {formatPeriod(period, groupBy)}
              </text>
            ) : null
          )}

          {/* One full-height hover target per period, so a thin bar is still easy to hit. */}
          {periods.map((period, i) => (
            <rect
              key={`hit-${period}`}
              x={PAD.left + i * slot}
              y={PAD.top}
              width={slot}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setActiveIndex(i)}
            />
          ))}
        </svg>

        {activeIndex !== null && (
          <ChartTooltip
            period={formatPeriod(periods[activeIndex], groupBy, true)}
            series={series}
            index={activeIndex}
            leftPercent={((activeIndex + 0.5) * slot + PAD.left) / VIEW_W}
            format={exactFormat}
          />
        )}
      </div>

      <ChartLegend series={series} />
      <ChartDataTable periods={periods} series={series} groupBy={groupBy} format={exactFormat} />
    </div>
  );
}

function ChartTooltip({
  period,
  series,
  index,
  leftPercent,
  format,
}: {
  period: string;
  series: ChartSeries[];
  index: number;
  leftPercent: number;
  format: (v: number) => string;
}) {
  // Flip the anchor near the edges so the card never overflows its container.
  const anchor = leftPercent > 0.75 ? "translate(-100%, 0)" : leftPercent < 0.25 ? "translate(0, 0)" : "translate(-50%, 0)";
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 min-w-[168px] rounded-lg border border-brown-600/15 bg-surface px-3 py-2 shadow-lg"
      style={{ left: `${leftPercent * 100}%`, transform: anchor }}
    >
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brown-500">{period}</p>
      <ul className="flex flex-col gap-1">
        {series.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-brown-600">
              <span className={`size-2 rounded-full bg-current ${s.colorClass}`} />
              {s.label}
            </span>
            <span className="font-semibold tabular-nums text-green-950">{format(s.values[index] ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-brown-600/10 pt-3">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-2 text-xs font-medium text-brown-600">
          <span className={`size-2.5 rounded-sm bg-current ${s.colorClass}`} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** The same numbers as a real table, hidden visually but read by assistive tech. */
function ChartDataTable({
  periods,
  series,
  groupBy,
  format,
}: {
  periods: string[];
  series: ChartSeries[];
  groupBy: ChartGroupBy;
  format: (v: number) => string;
}) {
  return (
    <table className="sr-only">
      <thead>
        <tr>
          <th>Period</th>
          {series.map((s) => (
            <th key={s.key}>{s.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {periods.map((period, i) => (
          <tr key={period}>
            <th scope="row">{formatPeriod(period, groupBy, true)}</th>
            {series.map((s) => (
              <td key={s.key}>{format(s.values[i] ?? 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Horizontal proportion bars for a category breakdown. Chosen over a pie or
 * donut because reading a share off bar lengths against a common baseline is
 * far easier than off angles.
 */
export function BreakdownBars({
  rows,
  valueKind = "money",
  emptyMessage = "Nothing to show yet.",
  colorClass = "text-green-900",
}: {
  rows: { label: string; value: number }[];
  valueKind?: "money" | "count";
  emptyMessage?: string;
  colorClass?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-brown-600/20 bg-cream-50">
        <p className="text-sm text-brown-500">{emptyMessage}</p>
      </div>
    );
  }

  const format = valueKind === "money" ? exactBDT : (v: number) => Math.round(v).toLocaleString("en-US");
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const total = rows.reduce((sum, r) => sum + Math.abs(r.value), 0);

  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((row) => {
        const share = total > 0 ? Math.round((Math.abs(row.value) / total) * 100) : 0;
        return (
          <li key={row.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium capitalize text-brown-600">{row.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-green-950">
                {format(row.value)}
                <span className="ml-2 text-xs font-medium text-brown-500">{share}%</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-cream-300">
              <div
                className={`h-full rounded-full bg-current transition-all duration-300 ${colorClass}`}
                style={{ width: `${Math.max(2, (Math.abs(row.value) / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
