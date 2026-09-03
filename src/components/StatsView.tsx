import { ColumnDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildStatsData } from "../query/stats";

interface StatsViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
}

export function StatsView({ rows, columns }: StatsViewProps) {
  const data = buildStatsData(rows, columns);
  const maxCount = Math.max(1, ...data.byStatus.map((d) => d.count), ...data.byCategory.map((d) => d.count));
  return (
    <div className="csv-db-stats">
      {data.byStatus.length > 0 && (
        <div className="csv-db-stats-section">
          <h4>By Status</h4>
          {data.byStatus.map((s) => (
            <div key={s.label} className="csv-db-stats-bar-row">
              <span className="csv-db-stats-label">{s.label}</span>
              <div className="csv-db-stats-bar-track"><div className="csv-db-stats-bar" style={{ width: `${(s.count / maxCount) * 100}%` }} /></div>
              <span className="csv-db-stats-count">{s.count}</span>
            </div>
          ))}
        </div>
      )}
      {data.byCategory.length > 0 && (
        <div className="csv-db-stats-section">
          <h4>By Category</h4>
          {data.byCategory.map((s) => (
            <div key={s.label} className="csv-db-stats-bar-row">
              <span className="csv-db-stats-label">{s.label}</span>
              <div className="csv-db-stats-bar-track"><div className="csv-db-stats-bar" style={{ width: `${(s.count / maxCount) * 100}%` }} /></div>
              <span className="csv-db-stats-count">{s.count}</span>
            </div>
          ))}
        </div>
      )}
      {data.avgByNumeric.length > 0 && (
        <div className="csv-db-stats-section">
          <h4>Average</h4>
          {data.avgByNumeric.map((s) => (
            <div key={s.name} className="csv-db-stats-bar-row">
              <span className="csv-db-stats-label">{s.name}</span>
              <span className="csv-db-stats-count">{s.avg.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
      {data.byStatus.length === 0 && data.byCategory.length === 0 && data.avgByNumeric.length === 0 && (
        <div className="csv-db-stats-empty">No stats — add a Status, Category, or Number column.</div>
      )}
    </div>
  );
}
