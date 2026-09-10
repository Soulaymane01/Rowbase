import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const PALETTE = [
  "var(--interactive-accent)",
  "#e8873a",
  "#4caf7d",
  "#9b6bd6",
  "#3aa6c9",
  "#e06090",
  "#c9a227",
  "#7a8b99",
];

const PAD = { top: 16, right: 20, bottom: 54, left: 56 };

interface HoverInfo {
  x: number;
  y: number;
  title: string;
  series?: string;
  value: string;
  color: string;
}

function colorFor(i: number): string {
  return PALETTE[i % PALETTE.length];
}

function formatNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  if (!Number.isInteger(v)) return v.toFixed(2).replace(/\.?0+$/, "");
  return String(v);
}

function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min, min + 1];
  const span = max - min;
  const step0 = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) {
    ticks.push(Number(v.toFixed(10)));
    if (ticks.length > 40) break;
  }
  return ticks;
}

function valueDomain(data: ChartData, includeZero: boolean): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const s of data.series) {
    for (const v of s.values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) max = min + 1;
  return [min, max];
}

interface CartesianProps {
  data: ChartData;
  kind: "bar" | "line" | "area";
  width: number;
  stacked: boolean;
  showValues: boolean;
  onHover: (info: HoverInfo | null) => void;
  wrapRef: React.RefObject<HTMLDivElement | null>;
}

function CartesianChart({ data, kind, width, stacked, showValues, onHover, wrapRef }: CartesianProps) {
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const n = data.labels.length;
  const seriesCount = Math.max(1, data.series.length);
  const band = innerW / Math.max(1, n);
  const step = n > 1 ? innerW / (n - 1) : 0;
  const rotateLabels = kind === "bar" ? band < 58 : step < 58;
  const height = Math.round(Math.max(260, Math.min(440, width * 0.5)) + (rotateLabels ? 26 : 0));
  const innerH = Math.max(10, height - PAD.top - PAD.bottom);

  const [dMin, dMax] = valueDomain(data, true);
  const ticks = niceTicks(dMin, dMax, 5);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const yFor = (v: number) => innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const zeroY = yFor(Math.max(yMin, Math.min(yMax, 0)));

  const xForPoint = (i: number) => (n > 1 ? i * step : innerW / 2);
  const xForBand = (i: number) => i * band + band / 2;

  const cumulative = useMemo(() => {
    if (!stacked) return null;
    return data.labels.map((_, li) => {
      let acc = 0;
      return data.series.map((s) => {
        const v = s.values[li] ?? 0;
        const base = acc;
        acc += v;
        return { base, top: acc, v };
      });
    });
  }, [data, stacked]);

  const hoverAt = (e: React.MouseEvent, title: string, series: string | undefined, value: number, color: string) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    onHover({
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
      title,
      series,
      value: formatNumber(value),
      color,
    });
  };

  return (
    <svg width={width} height={height} className="csv-db-chart-svg" role="img">
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {/* Gridlines + Y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={0} y1={yFor(t)} x2={innerW} y2={yFor(t)} className="csv-db-chart-gridline" />
            <text x={-8} y={yFor(t)} dy="0.32em" textAnchor="end" className="csv-db-chart-axis-label">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {/* Baseline */}
        <line x1={0} y1={zeroY} x2={innerW} y2={zeroY} className="csv-db-chart-axis-line" />

        {/* Bars */}
        {kind === "bar" &&
          data.labels.map((label, li) => {
            const groupW = band * 0.68;
            if (stacked && cumulative) {
              const stack = cumulative[li];
              return (
                <g key={li}>
                  {stack.map((seg, si) => {
                    const yTop = yFor(seg.top);
                    const yBase = yFor(seg.base);
                    const h = Math.max(0, yBase - yTop);
                    const x = xForBand(li) - groupW / 2;
                    return (
                      <rect
                        key={si}
                        x={x}
                        y={yTop}
                        width={groupW}
                        height={h}
                        fill={colorFor(si)}
                        className="csv-db-chart-bar"
                        onMouseMove={(e) => hoverAt(e, label, data.series[si]?.name, seg.v, colorFor(si))}
                        onMouseLeave={() => onHover(null)}
                      />
                    );
                  })}
                </g>
              );
            }
            const barW = Math.max(2, groupW / seriesCount);
            return (
              <g key={li}>
                {data.series.map((s, si) => {
                  const v = s.values[li] ?? 0;
                  const yTop = yFor(Math.max(v, 0));
                  const yBase = yFor(Math.min(v, 0));
                  const h = Math.max(1, yBase - yTop);
                  const x = xForBand(li) - groupW / 2 + si * barW;
                  return (
                    <g key={si}>
                      <rect
                        x={x}
                        y={yTop}
                        width={barW}
                        height={h}
                        fill={colorFor(si)}
                        className="csv-db-chart-bar"
                        onMouseMove={(e) => hoverAt(e, label, data.series.length > 1 ? s.name : undefined, v, colorFor(si))}
                        onMouseLeave={() => onHover(null)}
                      />
                      {showValues && barW > 16 && (
                        <text x={x + barW / 2} y={yTop - 4} textAnchor="middle" className="csv-db-chart-value-label">
                          {formatNumber(v)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

        {/* Line / Area */}
        {(kind === "line" || kind === "area") &&
          data.series.map((s, si) => {
            const pts = s.values.map((v, li) => [xForPoint(li), yFor(v)] as const);
            const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
            const fillPath =
              kind === "area" && n > 0
                ? `${path} L${xForPoint(n - 1)},${zeroY} L${xForPoint(0)},${zeroY} Z`
                : null;
            return (
              <g key={si}>
                {fillPath && <path d={fillPath} fill={colorFor(si)} opacity="0.2" />}
                <path d={path} fill="none" stroke={colorFor(si)} strokeWidth="2" strokeLinejoin="round" />
                {pts.map((p, li) => (
                  <circle
                    key={li}
                    cx={p[0]}
                    cy={p[1]}
                    r="3.5"
                    fill={colorFor(si)}
                    className="csv-db-chart-point"
                    onMouseMove={(e) => hoverAt(e, data.labels[li], data.series.length > 1 ? s.name : undefined, s.values[li], colorFor(si))}
                    onMouseLeave={() => onHover(null)}
                  />
                ))}
              </g>
            );
          })}

        {/* X labels */}
        {data.labels.map((label, li) => {
          const x = kind === "bar" ? xForBand(li) : xForPoint(li);
          return (
            <text
              key={li}
              x={x}
              y={innerH + 16}
              textAnchor={rotateLabels ? "end" : "middle"}
              className="csv-db-chart-axis-label"
              transform={rotateLabels ? `rotate(-38, ${x}, ${innerH + 16})` : undefined}
            >
              {label}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

interface PieProps {
  data: ChartData;
  width: number;
  onHover: (info: HoverInfo | null) => void;
  wrapRef: React.RefObject<HTMLDivElement | null>;
}

function PieChart({ data, width, onHover, wrapRef }: PieProps) {
  const size = Math.round(Math.min(Math.max(220, width * 0.5), 360));
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const innerR = r * 0.58;

  const values = data.labels.map((_, li) => data.series.reduce((sum, s) => sum + (s.values[li] ?? 0), 0));
  const total = values.reduce((a, b) => a + b, 0);

  let angle = -Math.PI / 2;
  const arcs = values.map((v, i) => {
    const frac = total > 0 ? v / total : 0;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const ix2 = cx + innerR * Math.cos(end);
    const iy2 = cy + innerR * Math.sin(end);
    const ix1 = cx + innerR * Math.cos(start);
    const iy1 = cy + innerR * Math.sin(start);
    const d =
      frac >= 0.999
        ? `M${cx - r},${cy} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0 M${cx - innerR},${cy} a${innerR},${innerR} 0 1 1 ${2 * innerR},0 a${innerR},${innerR} 0 1 1 ${-2 * innerR},0`
        : `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${large} 0 ${ix1},${iy1} Z`;
    return (
      <path
        key={i}
        d={d}
        fill={colorFor(i)}
        className="csv-db-chart-slice"
        onMouseMove={(e) => {
          const rect = wrapRef.current?.getBoundingClientRect();
          onHover({
            x: e.clientX - (rect?.left ?? 0),
            y: e.clientY - (rect?.top ?? 0),
            title: data.labels[i],
            value: `${formatNumber(v)} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`,
            color: colorFor(i),
          });
        }}
        onMouseLeave={() => onHover(null)}
      />
    );
  });

  return (
    <svg width={size} height={size} className="csv-db-chart-svg" role="img">
      <g>
        {arcs}
        <text x={cx} y={cy} textAnchor="middle" dy="0.32em" className="csv-db-chart-donut-total">
          {formatNumber(total)}
        </text>
      </g>
    </svg>
  );
}

function Legend({ data, kind }: { data: ChartData; kind: string }) {
  const isPie = kind === "pie";
  const items = isPie
    ? data.labels.map((label, i) => ({
        label,
        color: colorFor(i),
        value: data.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
      }))
    : data.series.map((s, i) => ({ label: s.name, color: colorFor(i), value: undefined }));
  if (items.length === 0) return null;
  if (!isPie && data.series.length <= 1) return null;
  const total = isPie ? items.reduce((sum, it) => sum + (it.value ?? 0), 0) : 0;
  return (
    <div className="csv-db-chart-legend">
      {items.map((it, i) => (
        <div key={i} className="csv-db-chart-legend-item">
          <span className="csv-db-chart-legend-swatch" style={{ background: it.color }} />
          <span className="csv-db-chart-legend-label">{it.label}</span>
          {it.value !== undefined && (
            <span className="csv-db-chart-legend-value">
              {formatNumber(it.value)}
              {total > 0 ? ` · ${Math.round((it.value / total) * 100)}%` : ""}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function ChartView({ rows, columns, activeView }: ChartViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const setWrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapRef.current = el;
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const update = () => setWidth(Math.max(280, el.clientWidth));
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      observerRef.current = ro;
    }
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const kind = activeView.chartType || "bar";
  const data = useMemo(() => {
    const config: ChartConfig = {
      type: kind,
      xColumn: activeView.chartXColumn || "",
      yColumn: activeView.chartYColumn || "",
      agg: activeView.chartAgg || "count",
      colorByColumn: activeView.chartColorByColumn,
      sort: activeView.chartSort,
    };
    return buildChartData(rows, columns, config);
  }, [rows, columns, activeView, kind]);

  if (!activeView.chartXColumn) {
    return (
      <div className="csv-db-empty">
        <div className="csv-db-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
          </svg>
        </div>
        <div className="csv-db-empty-title">Configure chart</div>
        <div className="csv-db-empty-desc">Pick an X column (and optionally a value + aggregation) in the chart settings.</div>
      </div>
    );
  }

  if (data.labels.length === 0) {
    return (
      <div className="csv-db-empty">
        <div className="csv-db-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 14l3-4 3 3 4-6" />
          </svg>
        </div>
        <div className="csv-db-empty-title">No data</div>
        <div className="csv-db-empty-desc">No rows match the current view.</div>
      </div>
    );
  }

  const stacked = activeView.chartStacked === true;
  const showValues = activeView.chartShowValues !== false && kind === "bar";

  return (
    <div className="csv-db-chart-scroll">
      <div className="csv-db-chart-wrap" ref={setWrapRef}>
        <div className="csv-db-chart-canvas">
          {kind === "pie" ? (
            <PieChart data={data} width={width} onHover={setHover} wrapRef={wrapRef} />
          ) : (
            <CartesianChart
              data={data}
              kind={kind === "area" ? "area" : kind === "line" ? "line" : "bar"}
              width={width}
              stacked={stacked}
              showValues={showValues}
              onHover={setHover}
              wrapRef={wrapRef}
            />
          )}
        </div>
        <Legend data={data} kind={kind} />
        {hover && (
          <div className="csv-db-chart-tooltip" style={{ left: Math.min(hover.x + 14, Math.max(0, width - 250)), top: hover.y - 8 }}>
            <span className="csv-db-chart-tooltip-swatch" style={{ background: hover.color }} />
            <div>
              <div className="csv-db-chart-tooltip-title">{hover.title}</div>
              {hover.series && <div className="csv-db-chart-tooltip-series">{hover.series}</div>}
              <div className="csv-db-chart-tooltip-value">{hover.value}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
