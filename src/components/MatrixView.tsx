import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { getMatrixQuadrant, isMatrixImportant, isMatrixUrgent } from "../query/matrix";
import { getNoteDisplayName } from "../note-utils";

interface MatrixViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onCardClick: (rowOriginalIndex: number) => void;
}

const QUADRANTS: { key: string; important: boolean; urgent: boolean; title: string; hint: string }[] = [
  { key: "q1", important: true, urgent: true, title: "Do first", hint: "Important · Urgent" },
  { key: "q2", important: true, urgent: false, title: "Schedule", hint: "Important · Not urgent" },
  { key: "q3", important: false, urgent: true, title: "Delegate", hint: "Not important · Urgent" },
  { key: "q4", important: false, urgent: false, title: "Eliminate", hint: "Not important · Not urgent" },
];

function renderCardValue(value: string, col: ColumnDef): string {
  if (!value) return "";
  if (col.type === "note" || col.type === "link") return getNoteDisplayName(value);
  if (col.type === "checkbox") return value === "true" ? "✓" : "";
  return value;
}

export function MatrixView({ rows, columns, displayColumns, activeView, onCardClick }: MatrixViewProps) {
  const importanceIdx = columns.findIndex((c) => c.name === activeView.matrixImportanceColumn);
  const urgencyIdx = columns.findIndex((c) => c.name === activeView.matrixUrgencyColumn);
  const importanceCol = importanceIdx >= 0 ? columns[importanceIdx] : undefined;
  const urgencyCol = urgencyIdx >= 0 ? columns[urgencyIdx] : undefined;
  const configured = Boolean(importanceCol || urgencyCol);

  const titleCol = displayColumns[0];
  const propCols = displayColumns.slice(1, 3);

  const buckets = QUADRANTS.map((quadrant) => ({
    ...quadrant,
    rows: [] as QueryResultRow[],
  }));

  const cellValue = (row: QueryResultRow, idx: number): string =>
    idx >= 0 ? row.computed?.[idx] ?? row.row[idx] ?? "" : "";

  for (const row of rows) {
    const important = isMatrixImportant(cellValue(row, importanceIdx), importanceCol, activeView.matrixImportanceHighValue);
    const urgent = isMatrixUrgent(cellValue(row, urgencyIdx), urgencyCol, activeView.matrixUrgencyHighValue);
    const quadrant = getMatrixQuadrant(important, urgent);
    buckets.find((b) => b.key === quadrant)?.rows.push(row);
  }

  return (
    <div className="csv-db-matrix">
      {!configured && (
        <div className="csv-db-matrix-hint">
          Pick an importance and urgency column in View options (⋯) to place rows in the quadrants.
        </div>
      )}
      <div className="csv-db-matrix-grid">
        {buckets.map((bucket) => (
          <div key={bucket.key} className={`csv-db-matrix-quadrant csv-db-matrix-${bucket.key}`}>
            <div className="csv-db-matrix-quadrant-header">
              <span className="csv-db-matrix-quadrant-title">{bucket.title}</span>
              <span className="csv-db-matrix-quadrant-hint">{bucket.hint}</span>
              <span className="csv-db-matrix-quadrant-count">{bucket.rows.length}</span>
            </div>
            <div className="csv-db-matrix-quadrant-body">
              {bucket.rows.length === 0 ? (
                <div className="csv-db-matrix-empty">No rows</div>
              ) : (
                bucket.rows.map((row) => {
                  const title = titleCol
                    ? row.computed?.[titleCol.dataIdx] ?? row.row[titleCol.dataIdx] ?? ""
                    : "";
                  return (
                    <div
                      key={row.originalIndex}
                      className="csv-db-matrix-card"
                      onClick={() => onCardClick(row.originalIndex)}
                    >
                      <div className="csv-db-matrix-card-title">{title || "Untitled"}</div>
                      {propCols.map(({ col, dataIdx }) => {
                        const val = renderCardValue(row.computed?.[dataIdx] ?? row.row[dataIdx] ?? "", col);
                        if (!val) return null;
                        return (
                          <div key={col.name} className="csv-db-matrix-card-prop">
                            <span className="csv-db-matrix-card-prop-name">{col.name}</span>
                            <span className="csv-db-matrix-card-prop-value">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
