import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp, usePortalContainer } from "../AppContext";
import { useClickOutside } from "../hooks/useClickOutside";
import { useDropdownFlip, dropdownStyle } from "../hooks/useDropdownFlip";
import { normalizeNoteValue } from "../note-utils";
import { IMG_EXTS } from "../image-utils";

interface ImageDropdownProps {
  currentValue: string;
  anchorRect: DOMRect;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function ImageDropdown({
  currentValue,
  anchorRect,
  onSelect,
  onClose,
}: ImageDropdownProps) {
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerDownInsideRef = useRef(false);
  const app = useApp();
  const portalContainer = usePortalContainer();

  const images = useMemo(
    () =>
      app.vault
        .getFiles()
        .filter((f) => IMG_EXTS.includes(f.extension.toLowerCase()))
        .map((f) => ({
          path: f.path,
          basename: f.name,
          folder: f.parent?.path || "",
          src: app.vault.getResourcePath(f),
        })),
    [app.vault]
  );

  const candidate = normalizeNoteValue(search);
  const lower = candidate.toLowerCase();
  const filtered = useMemo(() => {
    const results = images.filter(
      (f) => f.basename.toLowerCase().includes(lower) || f.path.toLowerCase().includes(lower)
    );
    return results.slice(0, 60);
  }, [images, lower]);

  const exactMatch = useMemo(
    () => images.some((f) => f.path.toLowerCase() === lower || f.basename.toLowerCase() === lower),
    [images, lower]
  );

  const commitTyped = () => {
    if (!candidate) return;
    const match = images.find(
      (f) => f.path.toLowerCase() === lower || f.basename.toLowerCase() === lower
    );
    onSelect(match ? match.path : candidate);
  };

  const handleDismiss = () => {
    if (candidate && candidate !== normalizeNoteValue(currentValue)) {
      commitTyped();
      return;
    }
    if (currentValue && !candidate) {
      onSelect("");
      return;
    }
    onClose();
  };

  useClickOutside([dropdownRef], handleDismiss);
  const placement = useDropdownFlip(anchorRect, dropdownRef);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return createPortal(
    <div
      ref={dropdownRef}
      className="csv-db-dropdown csv-db-image-dropdown"
      onMouseDownCapture={() => {
        pointerDownInsideRef.current = true;
      }}
      onMouseUpCapture={() => {
        pointerDownInsideRef.current = false;
      }}
      style={dropdownStyle(anchorRect, placement)}
    >
      <div
        className="csv-db-dropdown-input-area"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className="csv-db-dropdown-search"
          placeholder="Search images or paste a URL"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const nextTarget = e.relatedTarget as Node | null;
            if (pointerDownInsideRef.current) return;
            if (nextTarget && dropdownRef.current?.contains(nextTarget)) return;
            handleDismiss();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTyped();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
      </div>
      {candidate && !exactMatch && (
        <div className="csv-db-dropdown-item csv-db-image-use-value" onClick={commitTyped}>
          <span className="csv-db-image-item-icon">＋</span>
          <span className="csv-db-image-item-name">Use "{candidate}"</span>
        </div>
      )}
      {filtered.length > 0 && (
        <div className="csv-db-dropdown-list">
          {filtered.map((file) => (
            <div
              key={file.path}
              className="csv-db-dropdown-item"
              onClick={() => onSelect(file.path)}
            >
              <img className="csv-db-image-item-thumb" src={file.src} alt="" loading="lazy" />
              <span className="csv-db-image-item-name">{file.basename}</span>
              {file.folder && <span className="csv-db-note-item-path">{file.folder}</span>}
            </div>
          ))}
        </div>
      )}
    </div>,
    portalContainer
  );
}
