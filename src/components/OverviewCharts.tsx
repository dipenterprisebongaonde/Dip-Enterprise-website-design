
import Link from "next/link";

export type ChartPoint = {
  label: string;
  value: number;
  sublabel?: string;
};

function formatCompact(value: number) {
  if (value >= 100000) return `₹${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
}

function buildBars(points: ChartPoint[], color: string) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const width = 360;
  const height = 180;
  const padL = 42;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const gap = Math.min(14, innerW / Math.max(points.length * 2, 1));
  const barW = (innerW - gap * (points.length - 1)) / Math.max(points.length, 1);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padT + innerH - ratio * innerH,
    value: max * ratio,
  }));

  return {
    width,
    height,
    padL,
    padT,
    innerH,
    ticks,
    bars: points.map((point, index) => {
      const h = (point.value / max) * innerH;
      const x = padL + index * (barW + gap);
      const y = padT + (innerH - h);
      return {
        ...point,
        x,
        y,
        width: Math.max(barW, 8),
        height: Math.max(h, 3),
        color,
        labelX: x + barW / 2,
        labelY: height - 10,
      };
    }),
  };
}

function buildLine(points: ChartPoint[], color: string) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const width = 360;
  const height = 180;
  const padL = 42;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padT + innerH - ratio * innerH,
    value: max * ratio,
  }));

  const coords = points.map((point, index) => {
    const x = padL + index * step;
    const y = padT + (innerH - (point.value / max) * innerH);
    return { ...point, x, y, labelY: height - 10 };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1]?.x || padL} ${padT + innerH} L ${padL} ${padT + innerH} Z`;

  return { width, height, padL, padT, innerH, ticks, coords, line, area, color };
}

function EmptyState({ message }: { message: string }) {
  return <p className="chart-empty">{message}</p>;
}

export function OverviewCharts({
  salesPoints,
  purchasePoints,
  expensePoints,
  salesTotal,
  purchasesTotal,
  expensesTotal,
}: {
  salesPoints: ChartPoint[];
  purchasePoints: ChartPoint[];
  expensePoints: ChartPoint[];
  salesTotal: number;
  purchasesTotal: number;
  expensesTotal: number;
}) {
  const sales = buildLine(
    salesPoints.length ? salesPoints : [{ label: "—", value: 0 }],
    "#4aa3ff"
  );
  const purchases = buildBars(
    purchasePoints.length ? purchasePoints : [{ label: "—", value: 0 }],
    "#5d5fef"
  );
  const expenses = buildBars(
    expensePoints.length ? expensePoints : [{ label: "—", value: 0 }],
    "#ef5b6b"
  );

  return (
    <div className="overview-charts matrix">
      <article className="chart-card panel">
        <div className="chart-card-head">
          <div>
            <p className="chart-kicker">Sales matrix</p>
            <h3>Sales trend</h3>
            <p>Invoice amounts in selected range</p>
          </div>
          <div className="chart-total">
            <span>Total sale</span>
            <strong>₹{salesTotal.toLocaleString()}</strong>
          </div>
        </div>

        {salesPoints.length === 0 ? (
          <EmptyState message="No sales in this date range." />
        ) : (
          <>
            <svg
              className="chart-svg"
              viewBox={`0 0 ${sales.width} ${sales.height}`}
              role="img"
              aria-label="Sales trend chart"
            >
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4aa3ff" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#4aa3ff" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {sales.ticks.map((tick) => (
                <g key={tick.y}>
                  <line
                    x1={sales.padL}
                    x2={sales.width - 12}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="#e8ebf5"
                    strokeWidth="1"
                  />
                  <text x={4} y={tick.y + 3} className="chart-axis-text">
                    {formatCompact(tick.value)}
                  </text>
                </g>
              ))}
              <path d={sales.area} fill="url(#salesFill)" />
              <path
                d={sales.line}
                fill="none"
                stroke={sales.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {sales.coords.map((point, index) => (
                <g key={`${point.label}-${index}`}>
                  <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke={sales.color} strokeWidth="2.5" />
                  <text x={point.x} y={point.y - 8} textAnchor="middle" className="chart-value-text">
                    {formatCompact(point.value)}
                  </text>
                  <text x={point.x} y={point.labelY} textAnchor="middle" className="chart-axis-text">
                    {point.label}
                  </text>
                </g>
              ))}
            </svg>
          </>
        )}

        <Link href="/dashboard/sales" className="chart-link">
          View sales →
        </Link>
      </article>

      <article className="chart-card panel">
        <div className="chart-card-head">
          <div>
            <p className="chart-kicker">Purchases matrix</p>
            <h3>Purchases volume</h3>
            <p>Bill amounts in selected range</p>
          </div>
          <div className="chart-total">
            <span>Total purchase</span>
            <strong>₹{purchasesTotal.toLocaleString()}</strong>
          </div>
        </div>

        {purchasePoints.length === 0 ? (
          <EmptyState message="No purchases in this date range." />
        ) : (
          <svg
            className="chart-svg"
            viewBox={`0 0 ${purchases.width} ${purchases.height}`}
            role="img"
            aria-label="Purchases bar chart"
          >
            {purchases.ticks.map((tick) => (
              <g key={tick.y}>
                <line
                  x1={purchases.padL}
                  x2={purchases.width - 12}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="#e8ebf5"
                  strokeWidth="1"
                />
                <text x={4} y={tick.y + 3} className="chart-axis-text">
                  {formatCompact(tick.value)}
                </text>
              </g>
            ))}
            {purchases.bars.map((bar, index) => (
              <g key={`${bar.label}-${index}`}>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  rx="7"
                  fill={bar.color}
                />
                <text x={bar.labelX} y={bar.y - 6} textAnchor="middle" className="chart-value-text">
                  {formatCompact(bar.value)}
                </text>
                <text x={bar.labelX} y={bar.labelY} textAnchor="middle" className="chart-axis-text">
                  {bar.label}
                </text>
              </g>
            ))}
          </svg>
        )}

        <Link href="/dashboard/purchases" className="chart-link">
          View purchases →
        </Link>
      </article>

      <article className="chart-card panel">
        <div className="chart-card-head">
          <div>
            <p className="chart-kicker">Expenses matrix</p>
            <h3>Expense volume</h3>
            <p>Expense amounts in selected range</p>
          </div>
          <div className="chart-total">
            <span>Expenses</span>
            <strong>₹{expensesTotal.toLocaleString()}</strong>
          </div>
        </div>

        {expensePoints.length === 0 ? (
          <EmptyState message="No expenses in this date range." />
        ) : (
          <svg
            className="chart-svg"
            viewBox={`0 0 ${expenses.width} ${expenses.height}`}
            role="img"
            aria-label="Expenses bar chart"
          >
            {expenses.ticks.map((tick) => (
              <g key={tick.y}>
                <line
                  x1={expenses.padL}
                  x2={expenses.width - 12}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="#e8ebf5"
                  strokeWidth="1"
                />
                <text x={4} y={tick.y + 3} className="chart-axis-text">
                  {formatCompact(tick.value)}
                </text>
              </g>
            ))}
            {expenses.bars.map((bar, index) => (
              <g key={`${bar.label}-${index}`}>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  rx="7"
                  fill={bar.color}
                />
                <text x={bar.labelX} y={bar.y - 6} textAnchor="middle" className="chart-value-text">
                  {formatCompact(bar.value)}
                </text>
                <text x={bar.labelX} y={bar.labelY} textAnchor="middle" className="chart-axis-text">
                  {bar.label}
                </text>
              </g>
            ))}
          </svg>
        )}

        <Link href="/dashboard/expenses" className="chart-link">
          View expenses →
        </Link>
      </article>
    </div>
  );
}
