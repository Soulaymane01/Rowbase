import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ColumnDef, SelectOption } from "../types";
import { pickColor } from "../constants";
import { Tag } from "./Tag";
import { OptionEditPanel } from "./OptionEditPanel";
import { useClickOutside } from "../hooks/useClickOutside";
import { usePortalContainer } from "../AppContext";

interface SelectDropdownProps {
  column: ColumnDef;
  currentValue: string;
  anchorRect: DOMRect;
  onSelect: (value: string) => void;
  onCreateOption: (option: SelectOption) => void;
  onUpdateOption: (oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (value: string) => void;
  onClose: () => void;
}

export function SelectDropdown({
  column,
  currentValue,
  anchorRect,
  onSelect,
  onCreateOption,
  onUpdateOption,
  onRemoveOptionDef,
  onClose,
}: SelectDropdownProps) {
  const [search, setSearch] = useState("");
  const [editingOption, setEditingOption] = useState<SelectOption | null>(null);
  const [editAnchorRect, setEditAnchorRect] = useState<DOMRect | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const portalContainer = usePortalContainer();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useClickOutside([dropdownRef, popoverRef], handleClose);

  const options = column.options || [];
  const lower = search.toLowerCase();
  const filtered = options.filter((o) => o.value.toLowerCase().includes(lower) && o.value !== currentValue);
  const exactMatch = options.some((o) => o.value.toLowerCase() === lower);

  const handleCreate = () => {
    const newOption: SelectOption = {
      value: search.trim(),
      color: pickColor(options.length),
    };
    onCreateOption(newOption);
    onSelect(newOption.value);
  };

  const handleMoreClick = (e: React.MouseEvent, option: SelectOption) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    setEditAnchorRect(btn.getBoundingClientRect());
    setEditingOption(option);
  };

  const handleUpdateOption = (oldValue: string, newOption: SelectOption | null) => {
    onUpdateOption(oldValue, newOption);
    if (newOption === null) {
      setEditingOption(null);
      setEditAnchorRect(null);
    } else {
      setEditingOption(newOption);
    }
  };

  const handleEditClose = () => {
    setEditingOption(null);
    setEditAnchorRect(null);
  };

  const selectedOption = currentValue
    ? options.find((o) => o.value === currentValue)
    : null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="csv-db-dropdown"
      style={{
        // Align with the cell's top edge so the input area overlays the cell being edited
        top: `${anchorRect.top}px`,
        left: `${anchorRect.left}px`,
        width: `${anchorRect.width}px`,
      }}
    >
      <div className="csv-db-dropdown-input-area" onClick={() => {
        const input = dropdownRef.current?.querySelector<HTMLInputElement>(".csv-db-dropdown-search");
        input?.focus();
      }}>
        {selectedOption && (
          <Tag
            value={selectedOption.value}
            color={selectedOption.color || "gray"}
            onRemove={(e) => {
              e.stopPropagation();
              onSelect("");
            }}
          />
        )}
        <input
          className="csv-db-dropdown-search"
          placeholder={selectedOption ? "" : "Search or create..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      </div>
      <div className="csv-db-dropdown-hint">Select an option or create one</div>
      <div className="csv-db-dropdown-list">
        {search.trim() && !exactMatch && (
          <div
            className="csv-db-dropdown-item csv-db-dropdown-create"
            onClick={handleCreate}
          >
            Create <Tag value={search.trim()} color={pickColor(options.length)} />
          </div>
        )}
        {filtered.map((option) => (
          <div
            key={option.value}
            className="csv-db-dropdown-item"
            onClick={() => onSelect(option.value)}
          >
            <Tag value={option.value} color={option.color || "gray"} />
            <span
              className="csv-db-option-more-btn"
              onClick={(e) => handleMoreClick(e, option)}
            >
              ···
            </span>
          </div>
        ))}
      </div>
      {editingOption && editAnchorRect && (
        <OptionEditPanel
          option={editingOption}
          anchorRect={editAnchorRect}
          panelRef={popoverRef}
          onUpdate={handleUpdateOption}
          onRemoveOptionDef={onRemoveOptionDef}
          onClose={handleEditClose}
          onCloseDropdown={onClose}
        />
      )}
    </div>,
    portalContainer
  );
}
