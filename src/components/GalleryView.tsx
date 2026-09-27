import { useMemo } from "react";
import { App } from "obsidian";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { splitMultiSelect } from "../csv-parser";
import { splitRelationValue } from "../relation-utils";
import { useApp } from "../AppContext";
import { getNoteDisplayName, openNoteValue } from "../note-utils";
import { Tag } from "./Tag";
import { RelationPill } from "./RelationPill";
import { ProgressDisplay } from "./ProgressCell";
import { WikilinkText } from "./WikilinkText";
import { openExternalUrl } from "./LinkCell";
import { isImageLikeValue, resolveImageSrc } from "../image-utils";
import { isCoverColumnName, pickCoverColumn } from "../query/cover";

interface GalleryViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
  selectedRows: Set<number>;
  onToggleRowSelect: (rowIdx: number) => void;
}

function CardCover({ value, col, app }: { value: string; col: ColumnDef | null; app: App }) {
  const src = useMemo(() => {
    if (!value || !col) return null;
    return resolveImageSrc(app, value);
  }, [value, col, app]);

  if (!src) {
    return (
      <div className="csv-db-gallery-cover csv-db-gallery-cover-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M4 17l5-5 3.5 3.5L16 12l4 4" />
        </svg>
      </div>
    );
  }
  return (
    <div className="csv-db-gallery-cover">
      <img src={src} alt="" className="csv-db-gallery-cover-img" />
    </div>
  );
}

function renderProp(value: string, col: ColumnDef, app: App): React.ReactNode {
  if (!value) return null;
  if (col.type === "select") {
    const opt = col.options?.find((o) => o.value === value);
    return <Tag value={value} color={opt?.color || "gray"} />;
  }
  if (col.type === "multiselect") {
    return (
      <span className="csv-db-gallery-props">
        {splitMultiSelect(value).map((v) => {
          const opt = col.options?.find((o) => o.value === v);
          return <Tag key={v} value={v} color={opt?.color || "gray"} />;
        })}
      </span>
    );
  }
  if (col.type === "relation") {
    return (
      <span className="csv-db-gallery-props">
        {splitRelationValue(value, col).map((v) => <RelationPill key={v} value={v} />)}
      </span>
    );
  }
  if (col.type === "progress") {
    return <ProgressDisplay column={col} value={value} />;
  }
  if (col.type === "checkbox") {
    const checked = value === "true";
    return (
      <span className={`csv-db-gallery-check${checked ? " is-checked" : ""}`} aria-hidden="true">
        {checked ? "✓" : ""}
      </span>
    );
  }
  if (col.type === "note") {
    const basename = value.replace(/\.md$/, "").split("/").pop();
    return (
      <span className="csv-db-gallery-note" title={value}>
        <span className="csv-db-gallery-note-icon">📄</span>
        <span>{basename}</span>
      </span>
    );
  }
  if (col.type === "url" || col.type === "link") {
    const isUrl = col.type === "url";
    return (
      <span
        className="csv-db-gallery-link"
        title={value}
        onClick={(e) => {
          e.stopPropagation();
          if (isUrl) openExternalUrl(value);
          else void openNoteValue(app, value);
        }}
      >
        {isUrl ? value : getNoteDisplayName(value)}
      </span>
    );
  }
  return <WikilinkText value={value} />;
}

export function GalleryView({
  rows,
  columns,
  displayColumns,
  activeView,
  onDeleteRow,
  onCardClick,
  selectedRows,
  onToggleRowSelect,
}: GalleryViewProps) {
  const app = useApp();
  const coverCol = useMemo(() => {
    const hasCoverValue = (col: ColumnDef, colIdx: number) => {
      // Columns that name or type themselves as covers may hold URLs that
      // don't end in an image extension — trust them. Plain url/link columns
      // must actually look like images, otherwise a link gallery would show
      // empty covers.
      const trusted = col.type === "image" || isCoverColumnName(col.name);
      return rows.some((r) => {
        const value = r.computed?.[colIdx] ?? r.row[colIdx] ?? "";
        if (!value) return false;
        return trusted ? true : isImageLikeValue(app, value);
      });
    };
    return pickCoverColumn(columns, hasCoverValue);
  }, [columns, rows, app]);
  const titleCol = displayColumns[0];
  const propCols = displayColumns.slice(1);

  if (rows.length === 0) {
    return (
      <div className="csv-db-gallery-scroll">
        <div className="csv-db-empty">
          <div className="csv-db-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="M4 17l5-5 3.5 3.5L16 12l4 4" />
            </svg>
          </div>
          <div className="csv-db-empty-title">No cards yet</div>
          <div className="csv-db-empty-desc">Add a row to see it as a card here.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="csv-db-gallery-scroll">
      <div className="csv-db-gallery">
        {rows.map((r) => {
          const coverIdx = coverCol ? columns.findIndex((c) => c.name === coverCol.name) : -1;
          const coverValue = coverIdx !== -1 ? (r.computed?.[coverIdx] ?? r.row[coverIdx] ?? "") : "";
          const titleValue = titleCol ? (r.computed?.[titleCol.dataIdx] ?? r.row[titleCol.dataIdx] ?? "") : "";
          const selected = selectedRows.has(r.originalIndex);
          return (
            <div
              key={r.originalIndex}
              className={`csv-db-gallery-card${selected ? " is-selected" : ""}`}
              data-row-index={r.originalIndex}
              onClick={() => onCardClick(r.originalIndex)}
            >
              {coverCol && <CardCover value={coverValue} col={coverCol} app={app} />}
              <label
                className="csv-db-gallery-select"
                onClick={(e) => e.stopPropagation()}
                title="Select card"
              >
                <input
                  type="checkbox"
                  className="csv-db-checkbox csv-db-gallery-checkbox"
                  checked={selected}
                  onChange={() => onToggleRowSelect(r.originalIndex)}
                  aria-label="Select card"
                />
              </label>
              <div className="csv-db-gallery-card-body">
                <div className="csv-db-gallery-title" title={titleValue}>{titleValue || "Untitled"}</div>
                <div className="csv-db-gallery-props">
                  {propCols.map(({ col, dataIdx }) => {
                    const val = r.computed?.[dataIdx] ?? r.row[dataIdx] ?? "";
                    const rendered = renderProp(val, col, app);
                    return rendered ? <span key={col.name} className="csv-db-gallery-prop">{rendered}</span> : null;
                  })}
                </div>
              </div>
              <button
                className="csv-db-gallery-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRow(r.originalIndex);
                }}
                title="Delete row"
                aria-label="Delete row"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="3" y1="3" x2="11" y2="11" />
                  <line x1="11" y1="3" x2="3" y2="11" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
