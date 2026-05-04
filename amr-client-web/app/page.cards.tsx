import { CSSProperties, ReactNode } from "react";
import { Ic } from "./page.icons";

export function TrendChart({ data }: { data: number[] }) {
  const trendData = data.length >= 2 ? data : [0, 0];
  const width = 420;
  const height = 120;
  const padding = 12;
  const max = Math.max(...trendData);
  const min = Math.min(...trendData);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (trendData.length - 1);

  const points = trendData.map((value, index) => {
    const x = padding + index * stepX;
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return { x, y, value };
  });

  let wavePath = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    const cy = (prev.y + curr.y) / 2;
    wavePath += ` Q ${prev.x},${prev.y} ${cx},${cy}`;
  }
  wavePath += ` T ${points[points.length - 1].x},${points[points.length - 1].y}`;

  const area = `${wavePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;
  const current = trendData[trendData.length - 1] ?? 0;
  const previous = trendData[trendData.length - 2] ?? current;
  const change =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : Math.round(((current - previous) / previous) * 100);

  return (
    <div className="rr-chart-card">
      <div className="rr-panel-hd">
        <h3>Wave Trend</h3>
        <span className="rr-chip info">{trendData.length} points</span>
      </div>
      <div className="rr-chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="rr-chart-svg"
          role="img"
          aria-label="Trend overview chart"
        >
          <defs>
            <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#9ca3af" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2].map((row) => (
            <line
              key={row}
              x1={padding}
              x2={width - padding}
              y1={padding + ((height - padding * 2) / 2) * row}
              y2={padding + ((height - padding * 2) / 2) * row}
              stroke="#e2e8f0"
              strokeDasharray="4 6"
            />
          ))}
          <path d={area} fill="url(#trendFill)" />
          <path
            d={wavePath}
            fill="none"
            stroke="#6b7280"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={4}
            fill="#4b5563"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <div className="rr-chart-meta">
        <span>Current: {current}</span>
        <span>Change: {`${change >= 0 ? "+" : ""}${change}%`}</span>
        <span>Peak: {max}</span>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent,
  icon,
  trend,
  trendVal,
  sub,
}: {
  label: string;
  value: number | string;
  accent: string;
  icon: ReactNode;
  trend?: "up" | "down" | "neu";
  trendVal?: string;
  sub?: string;
}) {
  return (
    <div className="rr-stat-card" style={{ "--card-accent": accent } as CSSProperties}>
      <div className="rr-stat-header">
        <div className="rr-stat-icon">{icon}</div>
        {trend && (
          <div className={`rr-stat-trend ${trend}`}>
            {trend === "up" ? (
              <Ic.TrendUp />
            ) : trend === "down" ? (
              <Ic.TrendDn />
            ) : null}
            {trendVal}
          </div>
        )}
      </div>
      <div className="rr-stat-val">{value}</div>
      <div className="rr-stat-lbl">{label}</div>
      {sub && <div className="rr-stat-sub">{sub}</div>}
    </div>
  );
}
