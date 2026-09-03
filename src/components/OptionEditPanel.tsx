import { useState, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { SelectOption, TagColor } from "../types";
import { TAG_COLOR_OPTIONS, TAG_COLORS } from "../constants";
import { useClickOutside } from "../hooks/useClickOutside";
import { useApp, usePortalContainer } from "../AppContext";
import { DeleteOptionModal } from "./ColumnModal";

const COLOR_LABELS: Record<TagColor, string> = {
  gray: "Gray",
  brown: "Brown",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  red: "Red",
};

interface OptionEditPanelProps {
  option: SelectOption;
  anchorRect: DOMRect;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (value: string) => void;
  onClose: () => void;
  onCloseDropdown: () => void;
}

export function OptionEditPanel({ option, anchorRect, panelRef, onUpdate, onRemoveOptionDef, onClose, onCloseDropdown }: OptionEditPanelProps) {
  const app = useApp();
  const portalContainer = usePortalContainer();
  const [name, setName] = useState(option.value);
  const [color, setColor] = useState<TagColor>(option.color || "gray");

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useClickOutside([panelRef], handleClose);

  const [pos, setPos] = useState({ top: anchorRect.top, left: anchorRect.right + 6 });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    let left = anchorRect.right + 6;
    let top = anchorRect.top;
    if (left + panelWidth > window.innerWidth) {
      left = anchorRect.left - panelWidth - 6;
    }
    if (top + panelHeight > window.innerHeight) {
      top = window.innerHeight - panelHeight - 8;
    }
    setPos({ top, left });
  }, [anchorRect, panelRef]);

  const handleNameBlur = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== option.value) {
      onUpdate(option.value, { value: trimmed, color });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleColorClick = (c: TagColor) => {
    setColor(c);
    onUpdate(option.value, { value: name.trim() || option.value, color: c });
  };

  const handleDelete = () => {
    onCloseDropdown();
    new DeleteOptionModal(
      app,
      option.value || "this option",
      () => {
        onUpdate(option.value, null);
      },
      () => {
        onRemoveOptionDef(option.value);
      }
    ).open();
  };

  return createPortal(
    <div
      ref={panelRef}
      className="csv-db-option-edit-popover"
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
      }}
    >
      <div className="csv-db-option-edit-panel">
        <input
          className="csv-db-option-edit-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          autoFocus
        />
        <button className="csv-db-option-edit-delete" onClick={handleDelete}>
          Delete
        </button>
        <div className="csv-db-option-edit-separator" />
        <div className="csv-db-option-edit-colors-label">Colors</div>
        <div className="csv-db-option-edit-colors">
          {TAG_COLOR_OPTIONS.map((c) => {
            const colors = TAG_COLORS[c];
            return (
              <div
                key={c}
                className={`csv-db-option-edit-color-row ${c === color ? "is-active" : ""}`}
                onClick={() => handleColorClick(c)}
              >
                <span
                  className="csv-db-option-edit-color-swatch"
                  style={{ backgroundColor: colors.bg }}
                />
                <span className="csv-db-option-edit-color-name">{COLOR_LABELS[c]}</span>
                {c === color && <span className="csv-db-option-edit-color-check">✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    portalContainer
  );
}
