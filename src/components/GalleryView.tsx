import { useCallback, useMemo } from "react";
import { App } from "obsidian";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { splitMultiSelect } from "../csv-parser";
import { splitRelationValue } from "../relation-utils";
import { useApp } from "../AppContext";
import { Tag } from "./Tag";
import { RelationPill } from "./RelationPill";

interface GalleryViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

const IMG_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"];

function detectCoverColumn(columns: ColumnDef[]): ColumnDef | null {
  const nameMatch = columns.find((c) => /^(cover|image|photo|img|poster|thumbnail|thumb)$/i.test(c.name.trim()));
  if (nameMatch) return nameMatch;
  return columns.find((c) => c.type === "url" || c.type === "link") ?? null;
}

function CardCover({ value, col, app }: { value: string; col: ColumnDef | null; app: App }) {
  const src = useMemo(() => {
    if (!value || !col) return null;
    if (/^https?:\/\//.test(value)) return value;
    const file = app.vault.getFiles().find((f) => f.path === value || f.name === value || f.basename === value);
    if (file && IMG_EXTS.includes(file.extension)) return app.vault.getResourcePath(file);
    return null;
  }, [value, col, app]);
  if (!src) return <div className="csv-db-gallery-cover csv-db-gallery-cover-empty" />;
  return (
    <div className="csv-db-gallery-cover">
      <img src={src} alt="" className="csv-db-gallery-cover-img" />
    </div>
  );
}

function renderProp(value: string, col: ColumnDef): React.ReactNode {
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
  return <span>{value}</span>;
}

export function GalleryView({
  rows,
  columns,
  displayColumns,
  activeView,
  onSetCell,
  onDeleteRow,
  onCardClick,
}: GalleryViewProps) {
  const app = useApp();
  const coverCol = detectCoverColumn(columns);
  const titleCol = displayColumns[0];
  const propCols = displayColumns.slice(1);

  return (
    <div className="csv-db-gallery-scroll">
      <div className="csv-db-gallery">
        {rows.map((r) => {
          const coverValue = coverCol ? r.row[columns.findIndex((c) => c.name === coverCol.name)] : "";
          const titleValue = titleCol ? r.row[titleCol.dataIdx] : "";
          return (
            <div
              key={r.originalIndex}
              className="csv-db-gallery-card"
              data-row-index={r.originalIndex}
              onClick={() => onCardClick(r.originalIndex)}
            >
              <CardCover value={coverValue} col={coverCol} app={app} />
              <div className="csv-db-gallery-card-body">
                <div className="csv-db-gallery-title">{titleValue || "Untitled"}</div>
                <div className="csv-db-gallery-props">
                  {propCols.map(({ col, dataIdx }) => {
                    const rendered = renderProp(r.row[dataIdx], col);
                    return rendered ? <span key={col.name} className="csv-db-gallery-prop">{rendered}</span> : null;
                  })}
                </div>
              </div>
              <span
                className="csv-db-gallery-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRow(r.originalIndex);
                }}
              >
                ✕
              </span>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="csv-db-gallery-empty">No records match the current view.</div>
        )}
      </div>
    </div>
  );
}
