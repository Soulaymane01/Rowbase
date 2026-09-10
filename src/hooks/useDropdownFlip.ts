import { useLayoutEffect, useState, RefObject } from "react";

export type DropdownPlacement = "below" | "above";

/**
 * Measures a portal dropdown against its anchor rect and flips it above the
 * anchor when there is not enough space below it in the viewport.
 * Re-measures when the dropdown's content size changes (e.g. filtering).
 */
export function useDropdownFlip(
  anchorRect: DOMRect | null,
  dropdownRef: RefObject<HTMLElement | null>,
): DropdownPlacement {
  const [placement, setPlacement] = useState<DropdownPlacement>("below");

  useLayoutEffect(() => {
    const el = dropdownRef.current;
    if (!el || !anchorRect) return;

    const measure = () => {
      const height = el.offsetHeight;
      const win = activeWindow;
      const spaceBelow = win.innerHeight - anchorRect.bottom;
      const spaceAbove = anchorRect.top;
      const next: DropdownPlacement =
        height > spaceBelow && spaceAbove > spaceBelow ? "above" : "below";
      setPlacement((prev) => (prev === next ? prev : next));
    };

    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [anchorRect, dropdownRef]);

  return placement;
}

/** Style for a fixed-position dropdown honoring the computed placement. */
export function dropdownStyle(
  anchorRect: DOMRect,
  placement: DropdownPlacement,
): React.CSSProperties {
  if (placement === "above") {
    return {
      bottom: `${activeWindow.innerHeight - anchorRect.top}px`,
      left: `${anchorRect.left}px`,
      width: `${anchorRect.width}px`,
    };
  }
  return {
    top: `${anchorRect.top}px`,
    left: `${anchorRect.left}px`,
    width: `${anchorRect.width}px`,
  };
}
