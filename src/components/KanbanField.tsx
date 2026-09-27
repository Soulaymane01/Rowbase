import { useRef, useState } from "react";
import { ColumnDef, SelectOption } from "../types";
import { splitMultiSelect, joinMultiSelect } from "../csv-parser";
import { getNoteDisplayName, openNoteValue } from "../note-utils";
import { useApp } from "../AppContext";
import { SelectDropdown } from "./SelectDropdown";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import { Tag } from "./Tag";
import { ProgressDisplay, ProgressEditor, parseProgressPercent } from "./ProgressCell";
import { openExternalUrl } from "./LinkCell";
import { WikilinkText } from "./WikilinkText";
import { getImageDisplayName, resolveImageSrc } from "../image-utils";

interface KanbanFieldProps {
  column: ColumnDef;
  dataIdx: number;
  value: string;
  rowIdx: number;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onAddOption: (colIdx: number, option: SelectOption) => void;
  onUpdateOption: (colIdx: number, oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (colIdx: number, value: string) => void;
}

/** A single kanban card property row with inline editing. */
export function KanbanField({
  column,
  dataIdx,
  value,
  rowIdx,
  onSetCell,
  onAddOption,
  onUpdateOption,
  onRemoveOptionDef,
}: KanbanFieldProps) {
  const [openDropdown, setOpenDropdown] = useState<null | "select" | "progress">(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const app = useApp();

  const stopMouseDown = (e: React.MouseEvent) => e.stopPropagation();
  const anchorRect = anchorRef.current?.getBoundingClientRect() ?? null;

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      onSetCell(rowIdx, dataIdx, draft);
    }
  };

  if (column.type === "checkbox") {
    const checked = value === "true";
    return (
      <span
        className="csv-db-kanban-card-checkbox csv-db-kanban-field-editable"
        onMouseDown={stopMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          onSetCell(rowIdx, dataIdx, checked ? "false" : "true");
        }}
        title={`Toggle ${column.name}`}
      >
        <div className={`csv-db-checkbox ${checked ? "is-checked" : ""}`}>
          {checked && <span className="csv-db-checkbox-icon">✓</span>}
        </div>
        <span className="csv-db-kanban-card-checkbox-label">{column.name}</span>
      </span>
    );
  }

  if (column.type === "select") {
    const option = column.options?.find((o) => o.value === value);
    return (
      <span
        ref={anchorRef}
        className="csv-db-kanban-field-editable"
        onMouseDown={stopMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          setOpenDropdown("select");
        }}
      >
        {option ? (
          <Tag value={option.value} color={option.color || "gray"} />
        ) : (
          <span className="csv-db-kanban-field-empty">Empty</span>
        )}
        {openDropdown === "select" && anchorRect && (
          <SelectDropdown
            column={column}
            currentValue={value}
            anchorRect={anchorRect}
            onSelect={(v) => {
              onSetCell(rowIdx, dataIdx, v);
              setOpenDropdown(null);
            }}
            onCreateOption={(option) => onAddOption(dataIdx, option)}
            onUpdateOption={(oldValue, newOption) => onUpdateOption(dataIdx, oldValue, newOption)}
            onRemoveOptionDef={(v) => onRemoveOptionDef(dataIdx, v)}
            onClose={() => setOpenDropdown(null)}
          />
        )}
      </span>
    );
  }

  if (column.type === "multiselect") {
    const values = splitMultiSelect(value);
    return (
      <span
        ref={anchorRef}
        className="csv-db-kanban-card-tags csv-db-kanban-field-editable"
        onMouseDown={stopMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          setOpenDropdown("select");
        }}
      >
        {values.length > 0 ? (
          values.map((v) => {
            const option = column.options?.find((o) => o.value === v);
            return <Tag key={v} value={v} color={option?.color || "gray"} />;
          })
        ) : (
          <span className="csv-db-kanban-field-empty">Empty</span>
        )}
        {openDropdown === "select" && anchorRect && (
          <MultiSelectDropdown
            column={column}
            currentValues={values}
            anchorRect={anchorRect}
            onCommit={(next) => onSetCell(rowIdx, dataIdx, joinMultiSelect(next))}
            onCreateOption={(option) => onAddOption(dataIdx, option)}
            onUpdateOption={(oldValue, newOption) => onUpdateOption(dataIdx, oldValue, newOption)}
            onRemoveOptionDef={(v) => onRemoveOptionDef(dataIdx, v)}
            onClose={() => setOpenDropdown(null)}
          />
        )}
      </span>
    );
  }

  if (column.type === "progress") {
    return (
      <span
        ref={anchorRef}
        className="csv-db-kanban-field-editable"
        onMouseDown={stopMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          setOpenDropdown("progress");
        }}
        title="Click to edit"
      >
        <ProgressDisplay column={column} value={value} />
        {openDropdown === "progress" && anchorRect && (
          <ProgressEditor
            value={parseProgressPercent(value)}
            anchorRect={anchorRect}
            onChange={(v) => onSetCell(rowIdx, dataIdx, v)}
            onClose={() => setOpenDropdown(null)}
          />
        )}
      </span>
    );
  }

  if (column.type === "image") {
    const src = resolveImageSrc(app, value);
    return (
      <span className="csv-db-kanban-card-image" onMouseDown={stopMouseDown} onClick={(e) => e.stopPropagation()}>
        {src ? (
          <img className="csv-db-image-thumb" src={src} alt="" loading="lazy" />
        ) : (
          <span className="csv-db-image-missing" aria-hidden="true">▣</span>
        )}
        <span className="csv-db-kanban-card-image-name">{getImageDisplayName(value)}</span>
      </span>
    );
  }

  if (column.type === "url" || column.type === "link") {    const isUrl = column.type === "url";
    return (
      <span
        className="csv-db-kanban-card-link"
        title={value}
        onMouseDown={stopMouseDown}
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

  if (column.type === "note") {
    return (
      <span
        className="csv-db-kanban-card-note"
        onMouseDown={stopMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          if (value) void openNoteValue(app, value);
        }}
      >
        <span className="csv-db-note-cell-icon">📄</span>
        <span>{getNoteDisplayName(value)}</span>
      </span>
    );
  }

  if (column.type === "formula" || column.type === "rollup" || column.type === "relation" || column.type === "title") {
    return <span>{value}</span>;
  }

  // text, number, date
  if (editing) {
    return (
      <input
        className="csv-db-kanban-field-input"
        type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onMouseDown={stopMouseDown}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span
      className="csv-db-kanban-field-value"
      onMouseDown={stopMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      title={`Edit ${column.name}`}
    >
      {value ? <WikilinkText value={value} /> : <span className="csv-db-kanban-field-empty">Empty</span>}
    </span>
  );
}
