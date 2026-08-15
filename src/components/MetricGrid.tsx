
"use client";

import { useEffect, useId, useState } from "react";

type MetricTone = "purple" | "blue" | "green" | "red";

export type MetricSeriesPoint = {
  key: string;
  label: string;
  value: number;
};

type MetricItem = {
  label: string;
  value: string;
  hint?: string;
  tone?: MetricTone;
  points?: MetricSeriesPoint[];
  /** @deprecated prefer points */
  series?: number[];
  variant?: "bars" | "trend";
  pill?: string;
  touchHint?: string;
  /** Stretch trend line across a full-width card. */
  wide?: boolean;
};

const TREND_TONES: Record<
  MetricTone,
  { stroke: string; soft: string; pillClass: string }
> = {
  blue: {
    stroke: "#2563eb",
    soft: "rgba(37, 99, 235, 0.42)",
    pillClass: "tone-blue",
  },
  green: {
    stroke: "#16a34a",
    soft: "rgba(22, 163, 74, 0.4)",
    pillClass: "tone-green",
  },
  red: {
    stroke: "#dc2626",
    soft: "rgba(220, 38, 38, 0.4)",
    pillClass: "tone-red",
  },
  purple: {
    stroke: "#4f46e5",
    soft: "rgba(79, 70, 229, 0.4)",
    pillClass: "tone-purple",
  },
};

function money(value: number) {
  const formatted = Math.abs(value).toLocaleString("en-IN");
  return value < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

function SparkBars({ values, tone }: { values: number[]; tone: string }) {
  const series = values.length ? values.slice(0, 8) : [0, 0, 0, 0, 0, 0];
  while (series.length < 6) series.push(0);
  const max = Math.max(...series, 1);

  return (
    <div className={`metric-chart tone-${tone}`} aria-hidden>
      <div className="metric-chart-track" />
      {series.map((value, index) => {
        const ratio = value <= 0 ? 0.12 : Math.max(0.18, value / max);
        return (
          <span
            key={`${tone}-${index}-${value}`}
            className="metric-bar"
            style={{
              ["--bar-h" as string]: `${Math.round(ratio * 100)}%`,
              ["--bar-delay" as string]: `${index * 70}ms`,
            }}
          >
            <i />
          </span>
        );
      })}
    </div>
  );
}

function TrendGraph({
  points,
  tone,
  pill,
  selectedIndex,
  onSelect,
  wide = false,
}: {
  points: MetricSeriesPoint[];
  tone: MetricTone;
  pill: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  wide?: boolean;
}) {
  const width = wide ? 720 : 220;
  const height = wide ? 110 : 78;
  const padX = wide ? 10 : 12;
  const padTop = wide ? 20 : 16;
  const padBottom = wide ? 12 : 10;
  const dotR = wide ? 5.2 : 4.6;
  const activeDotR = wide ? 6.8 : 6.2;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;
  const palette = TREND_TONES[tone];
  const reactId = useId().replace(/:/g, "");
  const fillId = `trendFill-${tone}-${reactId}`;

  let series = points;
  if (series.length === 0) {
    series = [
      { key: "empty-0", label: "—", value: 0 },
      { key: "empty-1", label: "—", value: 0 },
    ];
  } else if (series.length === 1) {
    series = [series[0], series[0]];
  }

  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);

  const plotted = series.map((point, index) => {
    const x = padX + (index / Math.max(series.length - 1, 1)) * chartW;
    const y = padTop + (1 - (point.value - min) / span) * chartH;
    return { ...point, x, y, index };
  });

  const linePath = plotted
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const areaPath = [
    `M ${plotted[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)}`,
    ...plotted.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`),
    `L ${plotted[plotted.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(1)}`,
    "Z",
  ].join(" ");

  const activeIndex =
    selectedIndex == null
      ? plotted.length - 1
      : Math.min(selectedIndex, plotted.length - 1);
  const active = plotted[activeIndex];
  const prev = plotted[Math.max(0, activeIndex - 1)];
  const angle = (Math.atan2(active.y - prev.y, active.x - prev.x) * 180) / Math.PI;

  return (
    <div className={`metric-trend ${palette.pillClass}${wide ? " is-wide" : ""}`}>
      <div className="metric-trend-stage">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="metric-trend-svg"
          preserveAspectRatio={wide ? "none" : "xMidYMid meet"}
          role="img"
          aria-label={`${pill} trend`}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.soft} />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {plotted.map((point) => (
            <line
              key={`grid-${point.key}-${point.index}`}
              className="metric-trend-grid"
              x1={point.x}
              x2={point.x}
              y1={padTop}
              y2={padTop + chartH}
            />
          ))}

          <path className="metric-trend-area" d={areaPath} fill={`url(#${fillId})`} />
          <path
            className="metric-trend-line metric-trend-line-glow"
            d={linePath}
            stroke={palette.stroke}
            fill="none"
            pathLength={1}
          />
          <path
            className="metric-trend-line"
            d={linePath}
            stroke={palette.stroke}
            fill="none"
            pathLength={1}
          />

          {plotted.map((point) => {
            const isActive = point.index === activeIndex;
            return (
              <g key={`dot-${point.key}-${point.index}`}>
                <circle
                  className={`metric-trend-hit${isActive ? " is-active" : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r="16"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(point.index === selectedIndex ? null : point.index);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(point.index === selectedIndex ? null : point.index);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${point.label}: ${money(point.value)}`}
                />
                <circle
                  className={`metric-trend-dot-ring${isActive ? " is-active" : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r={isActive ? activeDotR + 2.4 : dotR + 1.6}
                  fill={palette.stroke}
                  style={{ animationDelay: `${220 + point.index * 50}ms` }}
                />
                <circle
                  className={`metric-trend-dot${isActive ? " is-active" : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r={isActive ? activeDotR : dotR}
                  stroke={palette.stroke}
                  style={{ animationDelay: `${260 + point.index * 50}ms` }}
                />
              </g>
            );
          })}

          <g transform={`translate(${active.x}, ${active.y}) rotate(${angle})`}>
            <path
              className="metric-trend-arrow"
              d="M 0 0 L -11 -5.2 L -11 5.2 Z"
              fill={palette.stroke}
            />
          </g>
        </svg>

        {selectedIndex != null && points[selectedIndex] ? (
          <div
            className="metric-trend-tooltip"
            style={{
              left: `${(active.x / width) * 100}%`,
            }}
          >
            <strong>{money(points[selectedIndex].value)}</strong>
            <span>{points[selectedIndex].label}</span>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="metric-trend-pill"
        onClick={() => onSelect(null)}
        aria-label={`Reset ${pill} to period total`}
      >
        {pill}
      </button>
    </div>
  );
}

function MetricCard({ item, index }: { item: MetricItem; index: number }) {
  const tone = item.tone || (["purple", "blue", "green", "red"] as const)[index % 4];
  const isTrend = item.variant === "trend";
  const points =
    item.points && item.points.length
      ? item.points
      : (item.series || []).map((value, i) => ({
          key: `n-${i}`,
          label: `#${i + 1}`,
          value,
        }));
  const rising =
    points.length >= 2 ? points[points.length - 1].value >= points[0].value : tone !== "red";
  const pill =
    item.pill ||
    item.label
      .replace(/total\s+/i, "")
      .trim()
      .toUpperCase();
  const wide = Boolean(item.wide);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(null);
  }, [item.value, points.map((p) => p.key).join("|")]);

  const selected = selectedIndex != null ? points[selectedIndex] : null;
  const displayValue = selected ? money(selected.value) : item.value;
  const displayHint = selected
    ? `${selected.label} · tap ${pill} to reset`
    : item.hint;

  return (
    <article
      className={`metric-card tone-${tone}${isTrend ? " is-trend" : ""}${
        wide ? " is-wide" : ""
      }${selected ? " is-selected" : ""}${rising ? "" : ""}`}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="metric-copy">
        <p className="label">{item.label}</p>
        <p className="value">{displayValue}</p>
        {displayHint ? <p className="hint">{displayHint}</p> : null}
        {!selected && item.touchHint ? (
          <p className="metric-touch-hint">{item.touchHint}</p>
        ) : null}
      </div>
      {isTrend ? (
        <TrendGraph
          points={points}
          tone={tone}
          pill={pill}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          wide={wide}
        />
      ) : (
        <SparkBars values={points.map((p) => p.value)} tone={tone} />
      )}
    </article>
  );
}

export function MetricGrid({
  items,
  className,
}: {
  items: MetricItem[];
  className?: string;
}) {
  return (
    <div className={`metric-row${className ? ` ${className}` : ""}`}>
      {items.map((item, index) => (
        <MetricCard key={item.label} item={item} index={index} />
      ))}
    </div>
  );
}
