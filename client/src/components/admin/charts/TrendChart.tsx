"use client";

/**
 * The project's charts. Hand-rolled SVG rather than a charting library, for
 * the same reason `lib/csvExport.ts` is hand-rolled: this app deliberately
 * carries no chart/form/state library, and everything the Analytics page needs
 * is a few dozen lines of geometry.
 *
 * Design intent is legibility for a non-technical reader, so: bars rather than
 * dense lines, money on the axis in short form (৳12k) with the exact figure in
 * a native tooltip on hover, a plain-language legend, and no gridline clutter
 * beyond four horizontal rules. Colors come from theme tokens via Tailwind's
 * `fill-*`/`stroke-*` utilities, so charts invert correctly in dark mode along
 * with everything else.
 *
 * Every chart is also rendered as a real (visually hidden) table underneath, so
 * a screen reader gets the numbers instead of an opaque graphic.
 */

export interface ChartSeries {
  key: string;
  label: string;
  /** Tailwind fill utility from a theme token, e.g. "fill-green-900". */
  className: string;
  values: number[];
}

/** Short money label for an axis — "৳1.2m" / "৳12k" / "৳950". */
export function compactBDT(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}৳${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  if (abs >= 1_000) return `${sign}৳${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}৳${abs}`;
}

/** Short count label for a non-money axis. */
function compactCount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/** Keeps the x-axis readable when a range has more periods than will fit. */
function labelStride(count: number): number {
  if (count <= 12) return 1;
  if (count <= 24) return 2;
  if (count <= 40) return 4;
  return Math.ceil(count / 10);
}

/** "Nice" axis maximum, so gridlines land on round numbers. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 300;
const PADDING = { top: 16, right: 12, bottom: 34, left: 54 };

/**
 * Grouped vertical bars over time. Handles negative values (a loss period
 * drops below the zero line) by placing the baseline wherever zero falls in
 * the value range rather than assuming it sits at the bottom.
 */
export function TrendChart({
  periods,
  series,
  valueKind = "money",
  emptyMessage = "No data in this range.",
}: {
  periods: string[];
  series: ChartSeries[];
  /** Drives axis/tooltip formatting only. */
  valueKind?: "money" | "count";
  emptyMessage?: string;
}) {
  if (periods.length === 0 || series.length === 0) {
    return <p className="py-8 text-center text-sm text-brown-500">{emptyMessage}</p>;
  }

  const format = valueKind === "money" ? compactBDT : compactCount;
  const allValues = series.flatMap((s) => s.values);
  const rawMax = Math.max(0, ...allValues);
  const rawMin = Math.min(0, ...allValues);
  const max = niceCeiling(rawMax);
  const min = rawMin < 0 ? -niceCeiling(Math.abs(rawMin)) : 0;
  const span = max - min || 1;

  const plotWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = VIEW_HEIGHT - PADDING.top - PADDING.bottom;
  const yFor = (value: number) => PADDING.top + ((max - value) / span) * plotHeight;
  const zeroY = yFor(0);

  const groupWidth = plotWidth / periods.length;
  // Leave a quarter of each slot as breathing room between groups.
  const barWidth = Math.max(2, (groupWidth * 0.75) / series.length);
  const stride = labelStride(periods.length);

  // Four evenly spaced gridlines across the value range.
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((t) => min + span * t);

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="h-64 w-full min-w-[520px]"
          role="img"
          aria-label={`${series.map((s) => s.label).join(" and ")} by period`}
        >
          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={PADDING.left}
                x2={VIEW_WIDTH - PADDING.right}
                y1={yFor(value)}
                y2={yFor(value)}
                className="stroke-brown-600/15"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={yFor(value) + 4}
                textAnchor="end"
                className="fill-brown-500 text-[11px]"
              >
                {format(Math.round(value))}
              </text>
            </g>
          ))}

          {/* The zero baseline is drawn solid so a loss reads unmistakably as below-the-line. */}
          <line
            x1={PADDING.left}
            x2={VIEW_WIDTH - PADDING.right}
            y1={zeroY}
            y2={zeroY}
            className="stroke-brown-600/40"
            strokeWidth={1}
          />

          {periods.map((period, i) => {
            const groupX = PADDING.left + i * groupWidth + (groupWidth - barWidth * series.length) / 2;
            return (
              <g key={period}>
                {series.map((s, seriesIndex) => {
                  const value = s.values[i] ?? 0;
                  const y = value >= 0 ? yFor(value) : zeroY;
                  const height = Math.max(1, Math.abs(yFor(value) - zeroY));
                  return (
                    <rect
                      key={s.key}
                      x={groupX + seriesIndex * barWidth}
                      y={y}
                      width={Math.max(1, barWidth - 1)}
                      height={height}
                      className={s.className}
                      rx={1}
                    >
                      {/* Native tooltip — exact figure on hover, no JS needed. */}
                      <title>{`${period} · ${s.label}: ${format(value)}`}</title>
                    </rect>
                  );
                })}
                {i % stride === 0 && (
                  <text
                    x={PADDING.left + i * groupWidth + groupWidth / 2}
                    y={VIEW_HEIGHT - PADDING.bottom + 16}
                    textAnchor="middle"
                    className="fill-brown-500 text-[11px]"
                  >
                    {period}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <ChartLegend series={series} />
      <ChartDataTable periods={periods} series={series} valueKind={valueKind} />
    </div>
  );
}

function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-xs text-brown-600">
          <svg width={10} height={10} aria-hidden="true">
            <rect width={10} height={10} rx={2} className={s.className} />
          </svg>
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
  valueKind,
}: {
  periods: string[];
  series: ChartSeries[];
  valueKind: "money" | "count";
}) {
  const format = valueKind === "money" ? compactBDT : compactCount;
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
            <th scope="row">{period}</th>
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
 * Horizontal proportion bars for a category breakdown (expenses by category,
 * orders by status). Chosen over a pie/donut because reading a share off bar
 * lengths against a common baseline is far easier than off angles.
 */
export function BreakdownBars({
  rows,
  valueKind = "money",
  emptyMessage = "Nothing to show yet.",
  barClassName = "bg-green-900",
}: {
  rows: { label: string; value: number; href?: string }[];
  valueKind?: "money" | "count";
  emptyMessage?: string;
  barClassName?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-brown-500">{emptyMessage}</p>;
  }

  const format = valueKind === "money" ? compactBDT : compactCount;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const total = rows.reduce((sum, r) => sum + Math.abs(r.value), 0);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const share = total > 0 ? Math.round((Math.abs(row.value) / total) * 100) : 0;
        return (
          <li key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-brown-600">{row.label}</span>
              <span className="shrink-0 font-semibold text-green-950">
                {format(row.value)}
                <span className="ml-1.5 text-xs font-normal text-brown-500">{share}%</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-cream-300">
              <div
                className={`h-full rounded-full ${barClassName}`}
                style={{ width: `${Math.max(2, (Math.abs(row.value) / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
