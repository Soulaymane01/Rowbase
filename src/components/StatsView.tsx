import { ColumnDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildStatsData, StatGroup } from "../query/stats";

interface StatsViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
}

const SELECT_COLORS: Record<string, string> = {
  red: "hsl(0, 70%, 60%)", green: "hsl(140, 50%, 45%)", blue: "hsl(210, 70%, 55%)",
  yellow: "hsl(40, 80%, 50%)", purple: "hsl(270, 55%, 55%)", pink: "hsl(330, 65%, 58%)",
  orange: "hsl(24, 80%, 55%)", gray: "hsl(0, 0%, 55%)", brown: "hsl(24, 40%, 45%)",
};

function barColor(color?: string): string {
  if (!color || !SELECT_COLORS[color]) return "var(--interactive-accent)";
  return SELECT_COLORS[color];
}

function BarGroup({ title, groups }: { title: string; groups: StatGroup[] }) {
  const total = groups.reduce((s, g) => s + g.count, 0);
  const maxCount = Math.max(1, ...groups.map((g) => g.count));
  return (
    <div className="csv-db-stats-card">
      <div className="csv-db-stats-card-header">
        <h4>{title}</h4>
        <span className="csv-db-stats-card-total">{total}</span>
      </div>
      <div className="csv-db-stats-bars">
        {groups.map((g) => (
          <div key={g.label} className="csv-db-stats-bar-row">
            <span className="csv-db-stats-label" title={g.label}>{g.label}</span>
            <div className="csv-db-stats-bar-track">
              <div className="csv-db-stats-bar" style={{ width: `${(g.count / maxCount) * 100}%`, background: barColor(g.color) }} />
            </div>
            <span className="csv-db-stats-count">{g.count}</span>
            <span className="csv-db-stats-pct">{total > 0 ? `${Math.round((g.count / total) * 100)}%` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsView({ rows, columns }: StatsViewProps) {
  const data = buildStatsData(rows, columns);
  const hasAny = data.bySelect.size > 0 || data.numericStats.length > 0 || data.dateByMonth.length > 0;
  return (
    <div className="csv-db-stats-v2">
      <div className="csv-db-stats-summary">
        <div className="csv-db-stats-summary-card">
          <span className="csv-db-stats-summary-value">{data.totalRows}</span>
          <span className="csv-db-stats-summary-label">Rows</span>
        </div>
        <div className="csv-db-stats-summary-card">
          <span className="csv-db-stats-summary-value">{columns.length}</span>
          <span className="csv-db-stats-summary-label">Columns</span>
        </div>
        {data.numericStats.length > 0 && (
          <div className="csv-db-stats-summary-card">
            <span className="csv-db-stats-summary-value">
              {data.numericStats.reduce((s, n) => s + n.sum, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
            <span className="csv-db-stats-summary-label">Total (all numbers)</span>
          </div>
        )}
      </div>
      <div className="csv-db-stats-grid">
        {Array.from(data.bySelect.entries()).map(([colName, groups]) => (
          <BarGroup key={colName} title={colName} groups={groups} />
        ))}
        {data.numericStats.length > 0 && (
          <div className="csv-db-stats-card">
            <div className="csv-db-stats-card-header"><h4>Numbers</h4></div>
            <div className="csv-db-stats-num-grid">
              {data.numericStats.map((ns) => (
                <div key={ns.name} className="csv-db-stats-num-col">
                  <div className="csv-db-stats-num-name">{ns.name}</div>
                  <div className="csv-db-stats-num-row"><span>Avg</span><span>{ns.avg.toFixed(1)}</span></div>
                  <div className="csv-db-stats-num-row"><span>Min</span><span>{ns.min.toLocaleString()}</span></div>
                  <div className="csv-db-stats-num-row"><span>Max</span><span>{ns.max.toLocaleString()}</span></div>
                  <div className="csv-db-stats-num-row"><span>Median</span><span>{ns.median.toLocaleString()}</span></div>
                  <div className="csv-db-stats-num-row"><span>Count</span><span>{ns.count}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.dateByMonth.length > 0 && (
          <div className="csv-db-stats-card">
            <div className="csv-db-stats-card-header">
              <h4>By Month</h4>
              <span className="csv-db-stats-card-total">{data.dateByMonth.reduce((s, d) => s + d.count, 0)}</span>
            </div>
            <div className="csv-db-stats-date-bars">
              {(() => {
                const maxD = Math.max(1, ...data.dateByMonth.map((d) => d.count));
                return data.dateByMonth.map((d) => (
                  <div key={d.label} className="csv-db-stats-date-col">
                    <div className="csv-db-stats-date-bar-track">
                      <div className="csv-db-stats-date-bar" style={{ height: `${(d.count / maxD) * 100}%` }} />
                    </div>
                    <span className="csv-db-stats-date-label">{d.label}</span>
                    <span className="csv-db-stats-date-count">{d.count}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
      {!hasAny && (
        <div className="csv-db-empty">
          <div className="csv-db-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="12" width="4" height="9"/>
              <rect x="10" y="7" width="4" height="14"/>
              <rect x="17" y="3" width="4" height="18"/>
            </svg>
          </div>
          <div className="csv-db-empty-title">No stats yet</div>
          <div className="csv-db-empty-desc">Add a Select, Number, or Date column to see statistics.</div>
        </div>
      )}
    </div>
  );
}
