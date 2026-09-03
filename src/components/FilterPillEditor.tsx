import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ColumnDef, FilterRule, FilterOperator } from "../types";
import { Tag } from "./Tag";
import { getTypeIcon } from "../constants";

interface FilterPillEditorProps {
  filter: FilterRule;
  columns: ColumnDef[];
  onUpdate: (update: Partial<FilterRule>) => void;
  onDelete: () => void;
  onClose: () => void;
}

function FilterTextValue({
  filter,
  onUpdateValue,
}: {
  filter: FilterRule;
  onUpdateValue: (value: string[]) => void;
}) {
  const [inputText, setInputText] = useState(filter.value.join(", "));

  useEffect(() => {
    setInputText(filter.value.join(", "));
  }, [filter.column, filter.operator]);

  return (
    <input
      className="csv-db-popover-input"
      placeholder="Value..."
      value={inputText}
      onChange={(e) => {
        setInputText(e.target.value);
        const values = e.target.value
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v !== "");
        onUpdateValue(values);
      }}
    />
  );
}

function FilterSelectDropdown({
  column,
  selectedValues,
  onUpdateValue,
  anchorRect,
}: {
  column: ColumnDef;
  selectedValues: string[];
  onUpdateValue: (value: string[]) => void;
  anchorRect: DOMRect;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const options = column.options || [];
  const filtered = options.filter((o) =>
    o.value.toLowerCase().includes(search.toLowerCase()) && !selectedValues.includes(o.value)
  );

  const addValue = (value: string) => {
    onUpdateValue([...selectedValues, value]);
  };

  return createPortal(
    <div
      ref={ref}
      className="csv-db-dropdown"
      data-csv-db-filter-dropdown=""
      style={{
        top: `${anchorRect.bottom + 4}px`,
        left: `${anchorRect.left}px`,
        width: `${Math.max(anchorRect.width, 200)}px`,
      }}
    >
      <div className="csv-db-dropdown-search-bar">
        <input
          className="csv-db-dropdown-search"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      </div>
      <div className="csv-db-dropdown-list">
        {filtered.map((option) => (
          <div
            key={option.value}
            className="csv-db-dropdown-item"
            onClick={(e) => {
              e.stopPropagation();
              addValue(option.value);
            }}
          >
            <Tag value={option.value} color={option.color || "gray"} />
          </div>
        ))}
      </div>
    </div>,
    activeDocument.body
  );
}

function FilterSelectValueTrigger({
  column,
  selectedValues,
  onUpdateValue,
}: {
  column: ColumnDef;
  selectedValues: string[];
  onUpdateValue: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Close dropdown on click outside (but not on trigger) or Escape
  useEffect(() => {
    if (!open) return;
    const doc = activeDocument;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const dropdownEl = doc.querySelector("[data-csv-db-filter-dropdown]");
      if (dropdownEl && dropdownEl.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    doc.addEventListener("mousedown", handleClick);
    doc.addEventListener("keydown", handleKey);
    return () => {
      doc.removeEventListener("mousedown", handleClick);
      doc.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleClick = () => {
    if (open) {
      setOpen(false);
    } else {
      setAnchorRect(triggerRef.current?.getBoundingClientRect() || null);
      setOpen(true);
    }
  };

  const removeValue = (value: string) => {
    onUpdateValue(selectedValues.filter((v) => v !== value));
  };

  const options = column.options || [];
  const selectedOptions = selectedValues.map(
    (v) => options.find((o) => o.value === v) || { value: v, color: "gray" as const }
  );

  return (
    <>
      <div
        ref={triggerRef}
        className="csv-db-filter-value-trigger"
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
      >
        {selectedOptions.length > 0
          ? selectedOptions.map((opt) => (
              <Tag
                key={opt.value}
                value={opt.value}
                color={opt.color || "gray"}
                onRemove={(e) => {
                  e.stopPropagation();
                  removeValue(opt.value);
                }}
              />
            ))
          : <span className="csv-db-filter-value-placeholder">Select...</span>
        }
      </div>
      {open && anchorRect && (
        <FilterSelectDropdown
          column={column}
          selectedValues={selectedValues}
          onUpdateValue={onUpdateValue}
          anchorRect={anchorRect}
        />
      )}
    </>
  );
}

export function FilterPillEditor({ filter, columns, onUpdate, onDelete, onClose }: FilterPillEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const doc = activeDocument;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(target) && !target.closest("[data-csv-db-filter-dropdown]")) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    doc.addEventListener("mousedown", handleClick);
    doc.addEventListener("keydown", handleKey);
    return () => {
      doc.removeEventListener("mousedown", handleClick);
      doc.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const column = columns.find((c) => c.name === filter.column);
  const isSelectType = column && (column.type === "select" || column.type === "multiselect");
  const showValue = filter.operator !== "is-empty" && filter.operator !== "is-not-empty";

  return (
    <div className="csv-db-pill-editor" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="csv-db-pill-editor-row">
        <div className="csv-db-select-wrapper">
          <select
            className="csv-db-popover-select"
            value={filter.column}
            onChange={(e) => onUpdate({ column: e.target.value, value: [] })}
          >
            {columns.map((col) => (
              <option key={col.name} value={col.name}>
                {getTypeIcon(col.type)} {col.name}
              </option>
            ))}
          </select>
        </div>
        <div className="csv-db-select-wrapper">
          <select
            className="csv-db-popover-select"
            value={filter.operator}
            onChange={(e) => {
              const op = e.target.value as FilterOperator;
              const update: Partial<FilterRule> = { operator: op };
              if (op === "is-empty" || op === "is-not-empty") {
                update.value = [];
              }
              onUpdate(update);
            }}
          >
            <option value="contains">Contains</option>
            <option value="does-not-contain">Does not contain</option>
            <option value="is-empty">Is empty</option>
            <option value="is-not-empty">Is not empty</option>
          </select>
        </div>
        {showValue && isSelectType && column && (
          <FilterSelectValueTrigger
            column={column}
            selectedValues={filter.value}
            onUpdateValue={(value) => onUpdate({ value })}
          />
        )}
        {showValue && !isSelectType && (
          <FilterTextValue
            filter={filter}
            onUpdateValue={(value) => onUpdate({ value })}
          />
        )}
        <button className="csv-db-popover-remove" onClick={onDelete}>✕</button>
      </div>
    </div>
  );
}
