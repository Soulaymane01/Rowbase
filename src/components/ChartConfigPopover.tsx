import { useMemo } from "react";
import { ColumnDef, ViewDef } from "../types";
import { ChartConfig, ChartKind, ChartAgg } from "../query/chart";

interface ChartConfigPopoverProps {
  activeView: ViewDef;
  columns: ColumnDef[];
  onUpdateView: (view: ViewDef) => void;
  onClose: () => void;
}

const CHART_KINDS: { value: ChartKind; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "pie", label: "Pie" },
  { value: "area", label: "Area" },
];
const AGGS: { value: ChartAgg; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
];

export function ChartConfigPopover({ activeView, columns, onUpdateView, onClose }: ChartConfigPopoverProps) {
  const textCols = useMemo(() => columns, [columns]);
  const numCols = useMemo(() => columns.filter((c) => c.type === "number"), [columns]);

  const set = (patch: Partial<ViewDef>) => {
    onUpdateView({ ...activeView, ...patch });
  };

  const config: ChartConfig = {
    type: activeView.chartType || "bar",
    xColumn: activeView.chartXColumn || "",
    yColumn: activeView.chartYColumn || "",
    agg: activeView.chartAgg || "count",
    colorByColumn: activeView.chartColorByColumn,
  };

  return (
    <div className="csv-db-popover csv-db-chart-config" onClick={(e) => e.stopPropagation()}>
      <div className="csv-db-chart-config-section-label">Type</div>
      <div className="csv-db-chart-config-row">
        {CHART_KINDS.map((k) => (
          <button
            key={k.value}
            className={`csv-db-chart-config-type${config.type === k.value ? " is-active" : ""}`}
            onClick={() => set({ chartType: k.value })}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="csv-db-chart-config-field">
        <label className="csv-db-chart-config-label">X (categories / dates)</label>
        <select className="csv-db-popover-select" value={config.xColumn} onChange={(e) => set({ chartXColumn: e.target.value })}>
          <option value="">—</option>
          {textCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {config.agg !== "count" && (
        <div className="csv-db-chart-config-field">
          <label className="csv-db-chart-config-label">Y (value)</label>
          <select className="csv-db-popover-select" value={config.yColumn} onChange={(e) => set({ chartYColumn: e.target.value })}>
            <option value="">—</option>
            {numCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="csv-db-chart-config-field">
        <label className="csv-db-chart-config-label">Aggregation</label>
        <select className="csv-db-popover-select" value={config.agg} onChange={(e) => set({ chartAgg: e.target.value as ChartAgg })}>
          {AGGS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      <div className="csv-db-chart-config-field">
        <label className="csv-db-chart-config-label">Color by</label>
        <select
          className="csv-db-popover-select"
          value={config.colorByColumn || ""}
          onChange={(e) => set({ chartColorByColumn: e.target.value || undefined })}
        >
          <option value="">—</option>
          {columns.filter((c) => c.type === "select" || c.type === "multiselect").map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <button className="csv-db-chart-config-done" onClick={onClose}>Done</button>
    </div>
  );
}
