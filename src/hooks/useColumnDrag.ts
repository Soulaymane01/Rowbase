import { useRef, useCallback, useState } from "react";
import { flushSync } from "react-dom";

export interface DragState {
  isDragging: boolean;
  dragColIdx: number;
}

const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  dragColIdx: -1,
};

const DRAG_THRESHOLD = 5;
const SWAP_ANIMATION_MS = 80;

interface UseColumnDragOptions {
  onReorder: (fromIdx: number, toIdx: number) => void;
  tableRef: React.RefObject<HTMLTableElement | null>;
}

export function useColumnDrag({ onReorder, tableRef }: UseColumnDragOptions) {
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE);
  const justDraggedRef = useRef(false);

  const onDragStart = useCallback(
    (colIdx: number, e: React.MouseEvent) => {
      if (e.button !== 0) return;

      const doc = activeDocument;
      const win = activeWindow;
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      let dragActive = true;
      let currentIdx = colIdx;
      // Prevents jitter when a narrow column swaps with a wide one
      let swapLock: "left" | "right" | null = null;
      let isAnimating = false;

      const performSwap = (
        direction: "left" | "right",
        fromIdx: number,
        neighborIdx: number,
      ) => {
        const table = tableRef.current;
        if (!table) return;

        isAnimating = true;

        swapLock = direction;

        const headerCells = table.querySelectorAll("th.csv-db-header-cell");
        const fromWidth = headerCells[fromIdx].getBoundingClientRect().width;
        const neighborWidth =
          headerCells[neighborIdx].getBoundingClientRect().width;

        const fromDelta =
          direction === "right" ? neighborWidth : -neighborWidth;
        const neighborDelta =
          direction === "right" ? -fromWidth : fromWidth;

        // Collect all cells in both columns (headers + body)
        const rows = table.querySelectorAll("tr");
        const cells: { el: HTMLElement; delta: number }[] = [];
        rows.forEach((row) => {
          const fc = row.children[fromIdx + 1] as HTMLElement;
          const nc = row.children[neighborIdx + 1] as HTMLElement;
          if (fc?.tagName === "TH" || fc?.tagName === "TD") {
            cells.push({ el: fc, delta: fromDelta });
          }
          if (nc?.tagName === "TH" || nc?.tagName === "TD") {
            cells.push({ el: nc, delta: neighborDelta });
          }
        });

        // Animate columns sliding into swapped positions
        cells.forEach(({ el, delta }) => {
          el.style.setProperty("--csv-db-swap-offset", `${delta}px`);
          el.classList.add("csv-db-col-swapping");
        });

        const newIdx = direction === "right" ? fromIdx + 1 : fromIdx - 1;
        const reorderToIdx =
          direction === "right" ? fromIdx + 2 : fromIdx - 1;

        win.setTimeout(() => {
          cells.forEach(({ el }) => {
            el.classList.remove("csv-db-col-swapping");
            el.style.removeProperty("--csv-db-swap-offset");
          });
          flushSync(() => {
            onReorder(fromIdx, reorderToIdx);
          });
          currentIdx = newIdx;
          isAnimating = false;
          if (dragActive) {
            setDragState({ isDragging: true, dragColIdx: currentIdx });
          }
        }, SWAP_ANIMATION_MS);
      };

      const onMove = (ev: MouseEvent) => {
        if (!dragging) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
            return;
          }
          dragging = true;
          doc.body.classList.add("csv-db-dragging");
          setDragState({ isDragging: true, dragColIdx: currentIdx });
        }

        // Skip all position checks during animation — currentIdx is stale
        // and CSS transforms distort getBoundingClientRect values
        if (isAnimating) return;

        const table = tableRef.current;
        if (!table) return;

        const headerCells = table.querySelectorAll("th.csv-db-header-cell");
        if (currentIdx < 0 || currentIdx >= headerCells.length) return;

        const currentRect = headerCells[currentIdx].getBoundingClientRect();

        // Reset lock when cursor is back within the current column
        if (ev.clientX >= currentRect.left && ev.clientX <= currentRect.right) {
          swapLock = null;
          return;
        }

        // Swap right
        if (
          swapLock !== "left" &&
          ev.clientX > currentRect.right &&
          currentIdx < headerCells.length - 1
        ) {
          performSwap("right", currentIdx, currentIdx + 1);
          return;
        }

        // Swap left
        if (
          swapLock !== "right" &&
          ev.clientX < currentRect.left &&
          currentIdx > 0
        ) {
          performSwap("left", currentIdx, currentIdx - 1);
          return;
        }
      };

      const onUp = () => {
        doc.removeEventListener("mousemove", onMove);
        doc.removeEventListener("mouseup", onUp);

        dragActive = false;
        if (dragging) {
          doc.body.classList.remove("csv-db-dragging");
          setDragState(INITIAL_DRAG_STATE);
          justDraggedRef.current = true;
        }
      };

      doc.addEventListener("mousemove", onMove);
      doc.addEventListener("mouseup", onUp);
    },
    [onReorder, tableRef]
  );

  const consumeJustDragged = useCallback((): boolean => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return true;
    }
    return false;
  }, []);

  return { dragState, onDragStart, consumeJustDragged };
}
