import { useState, useRef, useEffect, useCallback } from "react";
import { ColumnDef, SortRule, FilterRule } from "../types";
import { SortEditor } from "./SortEditor";
import { FilterPillEditor } from "./FilterPillEditor";
import { Tag } from "./Tag";

interface FilterSortBarProps {
  draftSorts: SortRule[];
  draftFilters: FilterRule[];
  columns: ColumnDef[];
  isDirty: boolean;
  onUpdateSorts: (sorts: SortRule[]) => void;
  onUpdateFilters: (filters: FilterRule[]) => void;
  onReset: () => void;
  onSave: () => void;
  onSaveAsNewView: () => void;
}

export function FilterSortBar({
  draftSorts,
  draftFilters,
  columns,
  isDirty,
  onUpdateSorts,
  onUpdateFilters,
  onReset,
  onSave,
  onSaveAsNewView,
}: FilterSortBarProps) {
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false);
  const [editingFilterIndex, setEditingFilterIndex] = useState<number | null>(null);
  const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);
  const sortPillRef = useRef<HTMLDivElement>(null);
  const saveGroupRef = useRef<HTMLDivElement>(null);

  // Close sort popover on outside click or Escape
  useEffect(() => {
    if (!sortPopoverOpen) return;
    const doc = activeDocument;
    const handleClick = (e: MouseEvent) => {
      if (sortPillRef.current && !sortPillRef.current.contains(e.target as Node)) {
        setSortPopoverOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortPopoverOpen(false);
    };
    doc.addEventListener("mousedown", handleClick);
    doc.addEventListener("keydown", handleKey);
    return () => {
      doc.removeEventListener("mousedown", handleClick);
      doc.removeEventListener("keydown", handleKey);
    };
  }, [sortPopoverOpen]);

  // Close save dropdown on outside click or Escape
  useEffect(() => {
    if (!saveDropdownOpen) return;
    const doc = activeDocument;
    const handleClick = (e: MouseEvent) => {
      if (saveGroupRef.current && !saveGroupRef.current.contains(e.target as Node)) {
        setSaveDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSaveDropdownOpen(false);
    };
    doc.addEventListener("mousedown", handleClick);
    doc.addEventListener("keydown", handleKey);
    return () => {
      doc.removeEventListener("mousedown", handleClick);
      doc.removeEventListener("keydown", handleKey);
    };
  }, [saveDropdownOpen]);

  const handleAddFilter = useCallback(() => {
    const first = columns[0];
    if (!first) return;
    const newFilters = [...draftFilters, { column: first.name, operator: "contains" as const, value: [] as string[] }];
    onUpdateFilters(newFilters);
    setEditingFilterIndex(newFilters.length - 1);
  }, [columns, draftFilters, onUpdateFilters]);

  const handleUpdateFilter = useCallback((index: number, update: Partial<FilterRule>) => {
    onUpdateFilters(draftFilters.map((f, i) => {
      if (i !== index) return f;
      return { ...f, ...update };
    }));
  }, [draftFilters, onUpdateFilters]);

  const handleDeleteFilter = useCallback((index: number) => {
    onUpdateFilters(draftFilters.filter((_, i) => i !== index));
    setEditingFilterIndex(null);
  }, [draftFilters, onUpdateFilters]);

  const operatorSymbol = (op: string) => {
    switch (op) {
      case "contains": return "⊇";
      case "does-not-contain": return "⊉";
      case "is-empty": return "= ∅";
      case "is-not-empty": return "≠ ∅";
      default: return op;
    }
  };

  const buildFilterPillContent = (filter: FilterRule) => {
    const op = operatorSymbol(filter.operator);
    const col = columns.find((c) => c.name === filter.column);
    const isSelectType = col && (col.type === "select" || col.type === "multiselect");

    if (filter.value.length === 0 || filter.operator === "is-empty" || filter.operator === "is-not-empty") {
      return <>{filter.column} {op}</>;
    }

    if (isSelectType && col.options) {
      const tags = filter.value.map((v) => {
        const opt = col.options!.find((o) => o.value === v);
        return <Tag key={v} value={v} color={opt?.color || "gray"} />;
      });
      return <>{filter.column} {op} <span className="csv-db-fsb-pill-tags">{tags}</span></>;
    }

    return <>{filter.column} {op} {filter.value.join(", ")}</>;
  };

  // Build sort pill label: "Name ↑ Status ↓" or dim "Sort"
  const sortPillLabel = draftSorts.length > 0
    ? draftSorts.map((s) => `${s.column} ${s.direction === "asc" ? "↑" : "↓"}`).join("  ")
    : "Unsorted";

  return (
    <div className="csv-db-filtersortbar">
      <div className="csv-db-fsb-pills">
        {/* Sort pill */}
        <div className="csv-db-fsb-sort-anchor" ref={sortPillRef}>
          <button
            className={`csv-db-fsb-pill${draftSorts.length > 0 ? "" : " csv-db-fsb-pill-dim"}`}
            onClick={() => setSortPopoverOpen((v) => !v)}
          >
            {sortPillLabel}
            {draftSorts.length === 0 && <span className="csv-db-fsb-pill-chevron">&#9662;</span>}
          </button>
          {sortPopoverOpen && (
            <SortEditor
              sorts={draftSorts}
              columns={columns}
              onUpdateSorts={onUpdateSorts}
            />
          )}
        </div>

        {/* Filter pills */}
        {draftFilters.map((filter, i) => (
          <div key={i} className="csv-db-fsb-filter-anchor">
            <button
              className="csv-db-fsb-pill"
              onClick={() => setEditingFilterIndex(editingFilterIndex === i ? null : i)}
            >
              {buildFilterPillContent(filter)}
            </button>
            {editingFilterIndex === i && (
              <FilterPillEditor
                filter={filter}
                columns={columns}
                onUpdate={(update) => handleUpdateFilter(i, update)}
                onDelete={() => handleDeleteFilter(i)}
                onClose={() => setEditingFilterIndex(null)}
              />
            )}
          </div>
        ))}

        {/* Add filter button */}
        <button className="csv-db-fsb-add-filter" onClick={handleAddFilter}>
          + Filter
        </button>
      </div>

      {/* Actions */}
      <div className="csv-db-fsb-actions">
        <button
          className={`csv-db-fsb-reset${isDirty ? "" : " csv-db-fsb-btn-disabled"}`}
          onClick={isDirty ? onReset : undefined}
        >
          Reset
        </button>
        <div className="csv-db-fsb-save-group" ref={saveGroupRef}>
          <div
            className={`csv-db-fsb-save${isDirty ? "" : " csv-db-fsb-save-disabled"}`}
            onClick={isDirty ? onSave : undefined}
          >
            Save
          </div><div
            className={`csv-db-fsb-save-chevron${isDirty ? "" : " csv-db-fsb-save-disabled"}`}
            onClick={isDirty ? () => setSaveDropdownOpen((v) => !v) : undefined}
          >
            &#9662;
          </div>
          {saveDropdownOpen && (
            <div className="csv-db-fsb-save-dropdown">
              <div
                className="csv-db-fsb-save-dropdown-item"
                onClick={() => {
                  setSaveDropdownOpen(false);
                  onSaveAsNewView();
                }}
              >
                Save as new view
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
