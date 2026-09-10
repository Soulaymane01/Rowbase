import { ColumnDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildStatsData, StatGroup, NumericStat, DateGroup } from "../query/stats";
import { TAG_COLORS } from "../constants";

interface StatsViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
}

const MAX_GROUPS = 10;

function formatNum(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function barColor(color?: string): string {
  if (color && color in TAG_COLORS) return TAG_COLORS[color as keyof typeof TAG_COLORS].bg;
  return "var(--interactive-accent)";
}

function topGroups(groups: StatGroup[]): StatGroup[] {
  if (groups.length <= MAX_GROUPS) return groups;
  const top = groups.slice(0, MAX_GROUPS);
  const other = groups.slice(MAX_GROUPS).reduce((s, g) => s + g.count, 0);
  return [...top, { label: "Other", count: other }];
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function DistributionCard({ title, groups, total }: { title: string; groups: StatGroup[]; total: number }) {
  const shown = topGroups(groups);
  const maxCount = Math.max(1, ...shown.map((g) => g.count));
  return (
    <div className="csv-db-stats-card">
      <div className="csv-db-stats-card-header">
        <h4>{title}</h4>
        <span className="csv-db-stats-card-total">{total}</span>
      </div>
      <div className="csv-db-stats-bars">
        {shown.map((g, i) => (
          <div key={`${g.label}-${i}`} className="csv-db-stats-bar-row">
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

function NumbersCard({ stats }: { stats: NumericStat[] }) {
  return (
    <div className="csv-db-stats-card">
      <div className="csv-db-stats-card-header"><h4>Numbers</h4></div>
      <div className="csv-db-stats-num-grid">
        {stats.map((ns) => (
          <div key={ns.name} className="csv-db-stats-num-col">
            <div className="csv-db-stats-num-name" title={ns.name}>{ns.name}</div>
            <div className="csv-db-stats-num-row"><span>Sum</span><span>{formatNum(ns.sum)}</span></div>
            <div className="csv-db-stats-num-row"><span>Avg</span><span>{formatNum(ns.avg)}</span></div>
            <div className="csv-db-stats-num-row"><span>Median</span><span>{formatNum(ns.median)}</span></div>
            <div className="csv-db-stats-num-row"><span>Min</span><span>{formatNum(ns.min)}</span></div>
            <div className="csv-db-stats-num-row"><span>Max</span><span>{formatNum(ns.max)}</span></div>
            <div className="csv-db-stats-num-row"><span>Range</span><span>{formatNum(ns.range)}</span></div>
            <div className="csv-db-stats-num-row"><span>Count</span><span>{ns.count}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckboxCard({ stats }: { stats: { name: string; checked: number; unchecked: number }[] }) {
  return (
    <div className="csv-db-stats-card">
      <div className="csv-db-stats-card-header"><h4>Checkboxes</h4></div>
      <div className="csv-db-stats-bars">
        {stats.map((s) => {
          const total = s.checked + s.unchecked;
          const pct = total > 0 ? Math.round((s.checked / total) * 100) : 0;
          return (
            <div key={s.name} className="csv-db-stats-check-row">
              <span className="csv-db-stats-label" title={s.name}>{s.name}</span>
              <div className="csv-db-stats-bar-track">
                <div className="csv-db-stats-bar" style={{ width: `${pct}%`, background: "var(--color-green)" }} />
              </div>
              <span className="csv-db-stats-count">{s.checked}/{total}</span>
              <span className="csv-db-stats-pct">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoverageCard({ coverage, totalRows }: { coverage: { name: string; filled: number }[]; totalRows: number }) {
  const rows = [...coverage].sort((a, b) => a.filled - b.filled);
  return (
    <div className="csv-db-stats-card">
      <div className="csv-db-stats-card-header">
        <h4>Field coverage</h4>
        <span className="csv-db-stats-card-total">{totalRows} rows</span>
      </div>
      <div className="csv-db-stats-bars">
        {rows.map((c) => {
          const pct = totalRows > 0 ? Math.round((c.filled / totalRows) * 100) : 0;
          return (
            <div key={c.name} className="csv-db-stats-bar-row">
              <span className="csv-db-stats-label" title={c.name}>{c.name}</span>
              <div className="csv-db-stats-bar-track">
                <div className="csv-db-stats-bar" style={{ width: `${pct}%`, background: "var(--interactive-accent)" }} />
              </div>
              <span className="csv-db-stats-count">{c.filled}</span>
              <span className="csv-db-stats-pct">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DateCard({ title, groups }: { title: string; groups: DateGroup[] }) {
  const maxD = Math.max(1, ...groups.map((d) => d.count));
  const total = groups.reduce((s, d) => s + d.count, 0);
  return (
    <div className="csv-db-stats-card">
      <div className="csv-db-stats-card-header">
        <h4>{title}</h4>
        <span className="csv-db-stats-card-total">{total}</span>
      </div>
      <div className="csv-db-stats-date-bars">
        {groups.map((d) => (
          <div key={d.label} className="csv-db-stats-date-col">
            <div className="csv-db-stats-date-bar-track">
              <div className="csv-db-stats-date-bar" style={{ height: `${(d.count / maxD) * 100}%` }} title={`${d.label}: ${d.count}`} />
            </div>
            <span className="csv-db-stats-date-label">{monthLabel(d.label)}</span>
            <span className="csv-db-stats-date-count">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsView({ rows, columns }: StatsViewProps) {
  const data = buildStatsData(rows, columns);

  const totalCells = data.totalRows * columns.length;
  const filledCells = data.coverage.reduce((s, c) => s + c.filled, 0);
  const filledPct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  // Date range across all date columns
  const allDates: string[] = [];
  for (const groups of data.dateByColumn.values()) for (const g of groups) allDates.push(g.date);
  allDates.sort();
  const dateRange = allDates.length > 0 ? `${monthLabel(allDates[0])} – ${monthLabel(allDates[allDates.length - 1])}` : null;

  const hasAny =
    data.bySelect.size > 0 ||
    data.numericStats.length > 0 ||
    data.dateByColumn.size > 0 ||
    data.checkboxStats.length > 0;

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
        <div className="csv-db-stats-summary-card">
          <span className="csv-db-stats-summary-value">{filledPct}%</span>
          <span className="csv-db-stats-summary-label">Filled cells</span>
        </div>
        {dateRange && (
          <div className="csv-db-stats-summary-card">
            <span className="csv-db-stats-summary-value csv-db-stats-summary-value-sm">{dateRange}</span>
            <span className="csv-db-stats-summary-label">Date range</span>
          </div>
        )}
      </div>

      {hasAny && (
        <div className="csv-db-stats-grid">
          {Array.from(data.bySelect.entries()).map(([colName, groups]) => (
            <DistributionCard
              key={colName}
              title={colName}
              groups={groups}
              total={groups.reduce((s, g) => s + g.count, 0)}
            />
          ))}
          {data.checkboxStats.length > 0 && <CheckboxCard stats={data.checkboxStats} />}
          {data.numericStats.length > 0 && <NumbersCard stats={data.numericStats} />}
          {data.coverage.length > 0 && <CoverageCard coverage={data.coverage} totalRows={data.totalRows} />}
          {Array.from(data.dateByColumn.entries()).map(([colName, groups]) => (
            <DateCard key={colName} title={`${colName} by month`} groups={groups} />
          ))}
        </div>
      )}

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
          <div className="csv-db-empty-desc">Add a Select, Number, Checkbox, or Date column to see statistics.</div>
        </div>
      )}
    </div>
  );
}
