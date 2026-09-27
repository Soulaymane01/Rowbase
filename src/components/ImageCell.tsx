import { useMemo, useRef, useState } from "react";
import { ColumnDef } from "../types";
import { useApp } from "../AppContext";
import { ImageDropdown } from "./ImageDropdown";
import { getImageDisplayName, resolveImageSrc } from "../image-utils";

interface ImageCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

export function ImageCell({ value, column, onChange }: ImageCellProps) {
  const [open, setOpen] = useState(false);
  const tdRef = useRef<HTMLTableCellElement>(null);
  const app = useApp();
  const src = useMemo(() => resolveImageSrc(app, value), [app, value]);

  return (
    <td
      className={`csv-db-cell csv-db-image-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`}
      onClick={() => setOpen(true)}
      ref={tdRef}
    >
      <span className="csv-db-image-cell-content">
        {src ? (
          <img className="csv-db-image-thumb" src={src} alt="" loading="lazy" />
        ) : value ? (
          <span className="csv-db-image-missing" aria-hidden="true">▣</span>
        ) : null}
        {value ? (
          <span className="csv-db-image-name">{getImageDisplayName(value)}</span>
        ) : null}
      </span>
      {open && tdRef.current && (
        <ImageDropdown
          currentValue={value}
          anchorRect={tdRef.current.getBoundingClientRect()}
          onSelect={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  );
}
