import { useEffect, RefObject } from "react";

export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  handler: () => void,
  active: boolean = true
): void {
  useEffect(() => {
    if (!active) return;

    const doc = activeDocument;
    const win = activeWindow;

    const listener = (e: MouseEvent) => {
      for (const ref of refs) {
        if (ref.current && ref.current.contains(e.target as Node)) {
          return;
        }
      }
      handler();
    };

    const keyListener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handler();
      }
    };

    // Delay to avoid catching the click that opened the dropdown
    const timer = win.setTimeout(() => {
      doc.addEventListener("mousedown", listener);
    }, 0);
    doc.addEventListener("keydown", keyListener);

    return () => {
      win.clearTimeout(timer);
      doc.removeEventListener("mousedown", listener);
      doc.removeEventListener("keydown", keyListener);
    };
  }, [refs, handler, active]);
}
