import type { MonthlyTotalsPoint } from "@/db/analytics";

type MonthlyTrendChartProps = {
  points: MonthlyTotalsPoint[];
};

function shortMonthLabel(ym: string) {
  const [y, m] = ym.split("-");

  return `${m}/${y.slice(2)}`;
}

/** Etykieta osi Y — wartosci w jednostkach minor (grosze). */
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

export function MonthlyTrendChart({ points }: MonthlyTrendChartProps) {
  const maxRaw = Math.max(
    100,
    ...points.map((p) => Math.max(p.incomePlnMinor, p.expensePlnMinor)),
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
  const n = points.length;

  if (n === 0) {
    return null;
  }

  const xAt = (index: number) => padL + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW);
  const yAt = (valueMinor: number) => padT + innerH - (valueMinor / maxY) * innerH;

  const incomePoints = points.map((p, i) => `${xAt(i)},${yAt(p.incomePlnMinor)}`).join(" ");
  const expensePoints = points.map((p, i) => `${xAt(i)},${yAt(p.expensePlnMinor)}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padT + innerH * (1 - t),
    label: formatAxisMinor(maxY * t),
  }));

  return (
    <div className="insights-chart-wrap">
      <svg
        aria-label="Wykres przychodow i wydatkow w ostatnich pelnych miesiacach"
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
        <text fill="#6b7280" fontSize={11} textAnchor="start" x={padL} y={h - 12}>
          Oś Y: zł (skrot liczb)
        </text>
        {points.map((p, i) => (
          <text
            fill="#6b7280"
            fontSize={n > 10 ? 8 : 10}
            key={p.month}
            textAnchor="end"
            transform={`rotate(-50 ${xAt(i)},${h - 18})`}
            x={xAt(i)}
            y={h - 6}
          >
            {shortMonthLabel(p.month)}
          </text>
        ))}
        <polyline fill="none" points={incomePoints} stroke="#15803d" strokeWidth={2.5} />
        <polyline fill="none" points={expensePoints} stroke="#b91c1c" strokeWidth={2.5} />
      </svg>
      <ul className="insights-chart-legend">
        <li>
          <span className="insights-chart-dot insights-chart-dot-income" /> Przychody
        </li>
        <li>
          <span className="insights-chart-dot insights-chart-dot-expense" /> Wydatki
        </li>
      </ul>
    </div>
  );
}
