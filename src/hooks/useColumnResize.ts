import { useRef, useCallback } from "react";

interface UseColumnResizeOptions {
  onResizeEnd: (colIdx: number, width: number) => void;
}

function measureColumnMaxWidth(colIdx: number): number {
  const table = document.querySelector(".csv-db-table") as HTMLTableElement | null;
  if (!table) return 180;

  const bodyRows = table.querySelectorAll("tbody tr");
  const span = document.createElement("span");
  span.style.visibility = "hidden";
  span.style.position = "absolute";
  span.style.whiteSpace = "nowrap";
  span.style.fontSize = "14px";
  span.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  document.body.appendChild(span);

  let maxW = 0;

  bodyRows.forEach((row) => {
    const cell = (row as HTMLTableRowElement).cells[colIdx + 1];
    if (!cell) return;
    span.textContent = cell.textContent || "";
    maxW = Math.max(maxW, span.getBoundingClientRect().width);
  });

  document.body.removeChild(span);

  const headerCells = table.querySelectorAll("thead th");
  const headerCell = headerCells[colIdx + 1] as HTMLElement | undefined;
  if (headerCell) {
    span.textContent = headerCell.textContent || "";
    maxW = Math.max(maxW, span.getBoundingClientRect().width);
  }

  return Math.round(Math.max(80, Math.min(500, maxW + 24)));
}

export { measureColumnMaxWidth };

export function useColumnResize({ onResizeEnd }: UseColumnResizeOptions) {
  const colGroupRef = useRef<HTMLTableColElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const justResizedRef = useRef(false);

  const fitColumnToContent = useCallback(
    (colIdx: number) => {
      const colGroup = colGroupRef.current;
      if (!colGroup) return;

      const colEl = colGroup.children[colIdx + 1] as HTMLElement;
      if (!colEl) return;

      const width = measureColumnMaxWidth(colIdx);
      colEl.style.width = `${width}px`;

      justResizedRef.current = true;
      onResizeEnd(colIdx, width);
    },
    [onResizeEnd]
  );

  const onResizeStart = useCallback(
    (colIdx: number, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const colGroup = colGroupRef.current;
      if (!colGroup) return;

      const colEl = colGroup.children[colIdx + 1] as HTMLElement;
      if (!colEl) return;

      const startX = e.clientX;
      const startWidth = parseInt(colEl.style.width, 10) || 180;

      const doc = activeDocument;
      const handle = e.currentTarget as HTMLElement;
      doc.body.classList.add("csv-db-resizing");
      handle.classList.add("csv-db-resize-active");

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newWidth = Math.max(80, startWidth + delta);
        colEl.style.width = `${newWidth}px`;
      };

      const onUp = () => {
        doc.removeEventListener("mousemove", onMove);
        doc.removeEventListener("mouseup", onUp);
        doc.body.classList.remove("csv-db-resizing");
        handle.classList.remove("csv-db-resize-active");

        justResizedRef.current = true;

        const finalWidth = parseInt(colEl.style.width, 10);
        onResizeEnd(colIdx, finalWidth);
      };

      doc.addEventListener("mousemove", onMove);
      doc.addEventListener("mouseup", onUp);
    },
    [onResizeEnd]
  );

  const consumeJustResized = useCallback((): boolean => {
    if (justResizedRef.current) {
      justResizedRef.current = false;
      return true;
    }
    return false;
  }, []);

  return { colGroupRef, tableRef, onResizeStart, consumeJustResized, fitColumnToContent };
}
