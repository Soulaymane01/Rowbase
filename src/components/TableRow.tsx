import { DisplayColumn, SelectOption } from "../types";
import { Cell } from "./Cell";

interface TableRowProps {
  rowIdx: number;
  row: string[];
  displayColumns: DisplayColumn[];
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onReorderRow: (fromRowIdx: number, toRowIdx: number, position: "before" | "after") => void;
  canReorderRows: boolean;
  onAddSelectOption: (colIdx: number, option: SelectOption) => void;
  onUpdateSelectOption: (colIdx: number, oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (colIdx: number, value: string) => void;
}

export function TableRow({
  rowIdx,
  row,
  displayColumns,
  onSetCell,
  onDeleteRow,
  onReorderRow,
  canReorderRows,
  onAddSelectOption,
  onUpdateSelectOption,
  onRemoveOptionDef,
}: TableRowProps) {
  return (
    <tr className="csv-db-row" data-row-index={rowIdx}>
      <td className="csv-db-row-drag-action">
        {canReorderRows && (
          <span
            className="csv-db-row-drag-handle"
            onMouseDown={(e) => startRowDrag(e, rowIdx, onReorderRow)}
            aria-label="Drag row"
          >
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        )}
      </td>
      {displayColumns.map(({ col, dataIdx }) => (
        <Cell
          key={dataIdx}
          value={row[dataIdx] || ""}
          column={col}
          onChange={(value) => onSetCell(rowIdx, dataIdx, value)}
          onAddOption={(option) => onAddSelectOption(dataIdx, option)}
          onUpdateOption={(oldValue, newOption) => onUpdateSelectOption(dataIdx, oldValue, newOption)}
          onRemoveOptionDef={(value) => onRemoveOptionDef(dataIdx, value)}
        />
      ))}
      <td className="csv-db-cell csv-db-cell-spacer" />
      <td className="csv-db-row-action">
        <span
          className="csv-db-row-delete"
          onClick={() => onDeleteRow(rowIdx)}
        >
          ✕
        </span>
      </td>
    </tr>
  );
}

function startRowDrag(
  e: React.MouseEvent,
  rowIdx: number,
  onReorderRow: (fromRowIdx: number, toRowIdx: number, position: "before" | "after") => void,
) {
  if (e.button !== 0) return;

  e.preventDefault();
  e.stopPropagation();

  const doc = activeDocument;
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;
  let dropTarget: HTMLTableRowElement | null = null;
  let dropPosition: "before" | "after" = "before";

  const clearDropTarget = () => {
    if (!dropTarget) return;
    dropTarget.classList.remove("csv-db-row-drop-before", "csv-db-row-drop-after");
    dropTarget = null;
  };

  const onMove = (ev: MouseEvent) => {
    if (!dragging) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      dragging = true;
      doc.body.classList.add("csv-db-row-dragging");
    }

    const target = doc.elementFromPoint(ev.clientX, ev.clientY);
    const rowEl = target?.closest(".csv-db-row");
    clearDropTarget();

    if (!(rowEl instanceof HTMLTableRowElement)) return;
    const targetRowIdx = Number(rowEl.dataset.rowIndex);
    if (!Number.isFinite(targetRowIdx) || targetRowIdx === rowIdx) return;

    const rect = rowEl.getBoundingClientRect();
    dropPosition = ev.clientY > rect.top + rect.height / 2 ? "after" : "before";
    if (!wouldReorderChange(rowIdx, targetRowIdx, dropPosition)) return;

    dropTarget = rowEl;
    rowEl.classList.add(dropPosition === "after" ? "csv-db-row-drop-after" : "csv-db-row-drop-before");
  };

  const onUp = () => {
    doc.removeEventListener("mousemove", onMove);
    doc.removeEventListener("mouseup", onUp);
    doc.body.classList.remove("csv-db-row-dragging");

    const targetRowIdx = dropTarget ? Number(dropTarget.dataset.rowIndex) : NaN;
    clearDropTarget();

    if (dragging && Number.isFinite(targetRowIdx)) {
      onReorderRow(rowIdx, targetRowIdx, dropPosition);
    }
  };

  doc.addEventListener("mousemove", onMove);
  doc.addEventListener("mouseup", onUp);
}

function wouldReorderChange(fromRowIdx: number, toRowIdx: number, position: "before" | "after") {
  if (fromRowIdx === toRowIdx) return false;
  if (position === "before" && toRowIdx === fromRowIdx + 1) return false;
  if (position === "after" && toRowIdx === fromRowIdx - 1) return false;
  return true;
}
