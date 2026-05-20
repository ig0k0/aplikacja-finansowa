import type { CategoryExpenseTrendSeries } from "@/db/analytics";

type CategoryExpenseTrendChartProps = {
  series: CategoryExpenseTrendSeries[];
};

const SERIES_COLORS = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f"] as const;

function shortMonthLabel(ym: string) {
  const [y, m] = ym.split("-");

  return `${m}/${y.slice(2)}`;
}

function formatAxisMinor(minor: number) {
  const pln = minor / 100;

  if (pln >= 10_000) {
    return `${Math.round(pln / 1000)}k`;
  }

  if (pln >= 1000) {
    return `${Math.round(pln / 100) / 10}k`;
  }

  return `${Math.round(pln)}`;
}

export function CategoryExpenseTrendChart({ series }: CategoryExpenseTrendChartProps) {
  const months = series[0]?.points.map((point) => point.month) ?? [];
  const n = months.length;

  if (n === 0) {
    return null;
  }

  const maxRaw = Math.max(
    100,
    ...series.flatMap((item) => item.points.map((point) => point.spentPlnMinor)),
  );
  const maxY = Math.max(Math.ceil((maxRaw * 1.08) / 10_000) * 10_000, 100);

  const w = 640;
  const h = 240;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 48;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const xAt = (index: number) => padL + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW);
  const yAt = (valueMinor: number) => padT + innerH - (valueMinor / maxY) * innerH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padT + innerH * (1 - t),
    label: formatAxisMinor(maxY * t),
  }));

  return (
    <div className="insights-chart-wrap">
      <svg
        aria-label="Wykres wydatkow w top kategoriach w ostatnich miesiacach"
        className="insights-chart-svg"
        role="img"
        viewBox={`0 0 ${w} ${h}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect fill="#fafafa" height={h} rx={12} width={w} x={0} y={0} />
        {yTicks.map((tick) => (
          <g key={`${tick.y}-${tick.label}`}>
            <line stroke="#e5e7eb" strokeWidth={1} x1={padL} x2={w - padR} y1={tick.y} y2={tick.y} />
            <text fill="#6b7280" fontSize={11} textAnchor="end" x={padL - 6} y={tick.y + 4}>
              {tick.label}
            </text>
          </g>
        ))}
        {months.map((month, index) => (
          <text
            fill="#6b7280"
            fontSize={n > 10 ? 8 : 10}
            key={month}
            textAnchor="end"
            transform={`rotate(-50 ${xAt(index)},${h - 18})`}
            x={xAt(index)}
            y={h - 6}
          >
            {shortMonthLabel(month)}
          </text>
        ))}
        {series.map((item, seriesIndex) => {
          const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
          const polyline = item.points.map((point, i) => `${xAt(i)},${yAt(point.spentPlnMinor)}`).join(" ");

          return (
            <polyline
              fill="none"
              key={item.categoryId ?? "none"}
              points={polyline}
              stroke={color}
              strokeWidth={2.5}
            />
          );
        })}
      </svg>
      <ul className="insights-chart-legend">
        {series.map((item, seriesIndex) => (
          <li key={item.categoryId ?? "none"}>
            <span
              className="insights-chart-dot"
              style={{ background: SERIES_COLORS[seriesIndex % SERIES_COLORS.length] }}
            />
            {item.categoryName}
          </li>
        ))}
      </ul>
    </div>
  );
}
