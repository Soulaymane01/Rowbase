import { useMemo } from "react";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildChartData, ChartData, ChartConfig } from "../query/chart";

interface ChartViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

const SERIES_COLORS = [
  "var(--interactive-accent)",
  "var(--color-orange)",
  "var(--color-green)",
  "var(--color-purple)",
  "var(--color-cyan)",
  "var(--color-pink)",
];

const W = 640;
const H = 320;
const PAD = { top: 20, right: 20, bottom: 40, left: 48 };

function maxOf(data: ChartData): number {
  let m = 0;
  for (const s of data.series) for (const v of s.values) if (v > m) m = v;
  return m;
}

function BarChart({ data }: { data: ChartData }) {
  const max = maxOf(data) || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = data.labels.length || 1;
  const band = innerW / n;
  const barW = Math.max(2, (band * 0.6) / Math.max(1, data.series.length));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="csv-db-chart-svg" preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {data.labels.map((label, li) => {
          return data.series.map((s, si) => {
            const v = s.values[li] ?? 0;
            const h = (v / max) * innerH;
            const x = li * band + si * barW + (band - barW * data.series.length) / 2;
            const y = innerH - h;
            return <rect key={`${label}-${si}`} x={x} y={y} width={barW} height={h} fill={SERIES_COLORS[si % SERIES_COLORS.length]} />;
          });
        })}
        {data.labels.map((label, li) => (
          <text key={label} x={li * band + band / 2} y={innerH + 16} textAnchor="middle" className="csv-db-chart-axis-label">{label}</text>
        ))}
      </g>
    </svg>
  );
}

function LineAreaChart({ data, area }: { data: ChartData; area: boolean }) {
  const max = maxOf(data) || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = data.labels.length;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const xFor = (li: number) => li * step;
  const yFor = (v: number) => innerH - (v / max) * innerH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="csv-db-chart-svg" preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {data.series.map((s, si) => {
          const pts = s.values.map((v, li) => [xFor(li), yFor(v)] as const);
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
          const fill = area
            ? <path d={`${path} L${xFor(n - 1)},${innerH} L0,${innerH} Z`} fill={SERIES_COLORS[si % SERIES_COLORS.length]} opacity="0.25" />
            : null;
          return (
            <g key={s.name}>
              {fill}
              <path d={path} fill="none" stroke={SERIES_COLORS[si % SERIES_COLORS.length]} strokeWidth="2" />
              {pts.map((p, li) => <circle key={li} cx={p[0]} cy={p[1]} r="3" fill={SERIES_COLORS[si % SERIES_COLORS.length]} />)}
            </g>
          );
        })}
        {data.labels.map((label, li) => (
          <text key={label} x={xFor(li)} y={innerH + 16} textAnchor="middle" className="csv-db-chart-axis-label">{label}</text>
        ))}
      </g>
    </svg>
  );
}

function PieChart({ data }: { data: ChartData }) {
  const values = data.series[0]?.values ?? [];
  const total = values.reduce((a, b) => a + b, 0);
  const cx = W / 2; const cy = H / 2; const r = Math.min(W, H) / 2 - 30;
  let angle = -Math.PI / 2;
  const arcs = values.map((v, i) => {
    const frac = total > 0 ? v / total : 0;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const x1 = cx + r * Math.cos(start); const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end); const y2 = cy + r * Math.sin(end);
    const large = frac > 0.5 ? 1 : 0;
    const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
    return <path key={i} d={d} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="csv-db-chart-svg" preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${PAD.left - PAD.right},0)`}>{arcs}</g>
    </svg>
  );
}

export function ChartView({ rows, columns, displayColumns, activeView, onSetCell, onDeleteRow, onCardClick }: ChartViewProps) {
  const data = useMemo(() => {
    const config: ChartConfig = {
      type: activeView.chartType || "bar",
      xColumn: activeView.chartXColumn || "",
      yColumn: activeView.chartYColumn || "",
      agg: activeView.chartAgg || "count",
      colorByColumn: activeView.chartColorByColumn,
    };
    return buildChartData(rows, columns, config);
  }, [rows, columns, activeView]);

  if (!data.labels.length) {
    return (
      <div className="csv-db-empty">
        <div className="csv-db-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
            <path d="M22 12A10 10 0 0 0 12 2v10z"/>
          </svg>
        </div>
        <div className="csv-db-empty-title">Configure chart</div>
        <div className="csv-db-empty-desc">Pick an X column (and optionally a Y value) in the chart settings.</div>
      </div>
    );
  }

  const kind = activeView.chartType || "bar";
  return (
    <div className="csv-db-chart-scroll">
      <div className="csv-db-chart">
        {kind === "bar" && <BarChart data={data} />}
        {kind === "pie" && <PieChart data={data} />}
        {kind === "line" && <LineAreaChart data={data} area={false} />}
        {kind === "area" && <LineAreaChart data={data} area={true} />}
      </div>
    </div>
  );
}
