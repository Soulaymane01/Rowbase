import { useRef, useCallback } from "react";

interface UseColumnResizeOptions {
  onResizeEnd: (colIdx: number, width: number) => void;
}

export function useColumnResize({ onResizeEnd }: UseColumnResizeOptions) {
  const colGroupRef = useRef<HTMLTableColElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const justResizedRef = useRef(false);

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

  return { colGroupRef, tableRef, onResizeStart, consumeJustResized };
}
