import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ColumnDef, SelectOption } from "../types";
import { pickColor } from "../constants";
import { Tag } from "./Tag";
import { OptionEditPanel } from "./OptionEditPanel";
import { useClickOutside } from "../hooks/useClickOutside";
import { usePortalContainer } from "../AppContext";
import { useDropdownFlip, dropdownStyle } from "../hooks/useDropdownFlip";

interface MultiSelectDropdownProps {
  column: ColumnDef;
  currentValues: string[];
  anchorRect: DOMRect;
  onCommit: (values: string[]) => void;
  onCreateOption: (option: SelectOption) => void;
  onUpdateOption: (oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (value: string) => void;
  onClose: () => void;
}

export function MultiSelectDropdown({
  column,
  currentValues,
  anchorRect,
  onCommit,
  onCreateOption,
  onUpdateOption,
  onRemoveOptionDef,
  onClose,
}: MultiSelectDropdownProps) {
  const [search, setSearch] = useState("");
  const [editingOption, setEditingOption] = useState<SelectOption | null>(null);
  const [editAnchorRect, setEditAnchorRect] = useState<DOMRect | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const portalContainer = usePortalContainer();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useClickOutside([dropdownRef, popoverRef], handleClose);
  const placement = useDropdownFlip(anchorRect, dropdownRef);

  const options = column.options || [];
  const lower = search.toLowerCase();
  const filtered = options.filter((o) => o.value.toLowerCase().includes(lower) && !currentValues.includes(o.value));
  const exactMatch = options.some((o) => o.value.toLowerCase() === lower);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [search]);

  useEffect(() => {
    if (focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const handleAdd = (value: string) => {
    if (!currentValues.includes(value)) {
      onCommit([...currentValues, value]);
    }
  };

  const handleRemove = (value: string) => {
    onCommit(currentValues.filter((v) => v !== value));
  };

  const handleCreate = () => {
    const newOption: SelectOption = {
      value: search.trim(),
      color: pickColor(options.length),
    };
    onCreateOption(newOption);
    onCommit([...currentValues, newOption.value]);
    setSearch("");
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = filtered.length + (search.trim() && !exactMatch ? 1 : 0);
    if (totalItems === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % totalItems);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIndex >= 0) {
          if (search.trim() && !exactMatch && focusedIndex === 0) {
            handleCreate();
          } else {
            const optionIndex = search.trim() && !exactMatch ? focusedIndex - 1 : focusedIndex;
            if (optionIndex >= 0 && optionIndex < filtered.length) {
              handleAdd(filtered[optionIndex].value);
            }
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  const selectedOptions = currentValues.map(
    (v) => options.find((o) => o.value === v) || { value: v, color: "gray" as const }
  );

  return createPortal(
    <div
      ref={dropdownRef}
      className="csv-db-dropdown"
      aria-expanded="true"
      aria-haspopup="listbox"
      style={dropdownStyle(anchorRect, placement)}
    >
      <div className="csv-db-dropdown-input-area" onClick={() => {
        const input = dropdownRef.current?.querySelector<HTMLInputElement>(".csv-db-dropdown-search");
        input?.focus();
      }}>
        {selectedOptions.map((opt) => (
          <Tag
            key={opt.value}
            value={opt.value}
            color={opt.color || "gray"}
            onRemove={(e) => {
              e.stopPropagation();
              handleRemove(opt.value);
            }}
          />
        ))}
        <input
          className="csv-db-dropdown-search"
          placeholder={selectedOptions.length > 0 ? "" : "Search or create..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
      <div className="csv-db-dropdown-hint">Select an option or create one</div>
      <div className="csv-db-dropdown-list" role="listbox">
        {search.trim() && !exactMatch && (
          <div
            ref={(el) => { optionRefs.current[0] = el; }}
            className="csv-db-dropdown-item csv-db-dropdown-create"
            data-focused={focusedIndex === 0 ? "true" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              handleCreate();
            }}
          >
            Create <Tag value={search.trim()} color={pickColor(options.length)} />
          </div>
        )}
        {filtered.map((option, index) => {
          const itemIndex = search.trim() && !exactMatch ? index + 1 : index;
          return (
            <div
              key={option.value}
              ref={(el) => { optionRefs.current[itemIndex] = el; }}
              className="csv-db-dropdown-item"
              data-focused={focusedIndex === itemIndex ? "true" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                handleAdd(option.value);
              }}
            >
              <Tag value={option.value} color={option.color || "gray"} />
              <span
                className="csv-db-option-more-btn"
                onClick={(e) => handleMoreClick(e, option)}
              >
                ···
              </span>
            </div>
          );
        })}
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
