import { useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ColumnDef } from "../types";
import { AggregateOption, getAggregateOptions } from "../query/aggregate";
import { useClickOutside } from "../hooks/useClickOutside";
import { usePortalContainer } from "../AppContext";
import { useDropdownFlip, dropdownStyle } from "../hooks/useDropdownFlip";

interface AggregateMenuProps {
  column: ColumnDef;
  current: string | undefined;
  anchorRect: DOMRect;
  onSelect: (aggregate: string | undefined) => void;
  onClose: () => void;
}

export function AggregateMenu({
  column,
  current,
  anchorRect,
  onSelect,
  onClose,
}: AggregateMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const portalContainer = usePortalContainer();
  const placement = useDropdownFlip(anchorRect, menuRef);

  useClickOutside([menuRef], onClose);

  const options: AggregateOption[] = getAggregateOptions(column);

  const handleSelect = useCallback(
    (id: AggregateOption) => {
      onSelect(id.id === "none" ? undefined : id.id);
      onClose();
    },
    [onSelect, onClose]
  );

  return createPortal(
    <div
      ref={menuRef}
      className="csv-db-dropdown csv-db-aggregate-menu"
      style={dropdownStyle(anchorRect, placement)}
    >
      <div className="csv-db-dropdown-hint">Calculate</div>
      <div className="csv-db-dropdown-list" role="listbox">
        {options.map((option) => (
          <div
            key={option.id}
            className="csv-db-dropdown-item"
            role="option"
            aria-selected={option.id === (current ?? "none")}
            data-selected={option.id === (current ?? "none") ? "true" : undefined}
            onClick={() => handleSelect(option)}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>,
    portalContainer
  );
}
