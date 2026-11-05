import { Menu } from "obsidian";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { NoteOpenMode } from "./note-utils";

/** Ctrl/Cmd-click opens attached notes in a right split instead of the current pane. */
export function noteOpenModeForClick(event: ReactMouseEvent): NoteOpenMode {
  return event.metaKey || event.ctrlKey ? "split" : "current";
}

/**
 * Right-click menu for attached notes: open here, or open to the right
 * (the same choices Obsidian offers on links).
 */
export function showNoteContextMenu(
  event: ReactMouseEvent,
  open: (mode: NoteOpenMode) => void
): void {
  event.preventDefault();
  event.stopPropagation();

  const menu = new Menu();
  menu.addItem((item) =>
    item
      .setTitle("Open")
      .setIcon("file-text")
      .onClick(() => open("current"))
  );
  menu.addItem((item) =>
    item
      .setTitle("Open to the right")
      .setIcon("split-square-horizontal")
      .onClick(() => open("split"))
  );
  menu.showAtMouseEvent(event.nativeEvent);
}
