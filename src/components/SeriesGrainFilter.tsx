
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SeriesGrain } from "@/lib/metric-series";

const OPTIONS: { value: SeriesGrain; label: string }[] = [
  { value: "day", label: "Day wise" },
  { value: "month", label: "Month wise" },
  { value: "year", label: "Year wise" },
];

export function SeriesGrainFilter({
  basePath,
  currentGrain,
}: {
  basePath: string;
  currentGrain: SeriesGrain;
}) {
  const searchParams = useSearchParams();

  function hrefFor(grain: SeriesGrain) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("grain", grain);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <div className="series-grain-filter" role="group" aria-label="Stack grouping">
      <span className="series-grain-label">View</span>
      <div className="series-grain-chips">
        {OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            className={`filter-chip${currentGrain === option.value ? " active" : ""}`}
            scroll={false}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
