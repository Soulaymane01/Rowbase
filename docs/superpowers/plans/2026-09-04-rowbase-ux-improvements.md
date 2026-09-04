# Rowbase UX Improvements Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add undo/redo, keyboard shortcuts, better empty states, column width presets, multi-select keyboard nav, mobile responsive CSS, and basic accessibility.

**Architecture:** Undo/redo uses a history stack wrapping the existing `databaseReducer`. Keyboard shortcuts are a single `useEffect` in `DatabaseTable`. Empty states are inline JSX with icons. Responsive is CSS-only. Accessibility is additive ARIA attributes.

---

## Task 1: Undo/Redo History Stack

**Files:**
- Modify: `src/components/DatabaseTable.tsx` — wrap `databaseReducer` with `withHistory` HOC

**Implementation:**
- Create a `withHistory(reducer)` wrapper that maintains `{ past: State[], present: State, future: State[] }`
- On any dispatch (except UNDO/REDO): push present to past, clear future, compute new present
- On UNDO: pop from past, push present to future
- On REDO: pop from future, push present to past
- Cap history at 100 entries to limit memory
- Add `UNDO` and `REDO` action types to the reducer union
- Expose `canUndo` and `canRedo` from state for toolbar/UI

---

## Task 2: Global Keyboard Shortcuts

**Files:**
- Modify: `src/components/DatabaseTable.tsx` — add `useEffect` for global keydown

**Shortcuts:**
- `Cmd/Ctrl+Z` → UNDO
- `Cmd/Ctrl+Shift+Z` or `Cmd/Ctrl+Y` → REDO
- `Cmd/Ctrl+Enter` → ADD_ROW (append new row)
- `Delete` or `Cmd/Ctrl+Backspace` → DELETE_ROW (when a row is focused/selected)
- `Escape` → close any open dropdown/modal/popover (already mostly done per-component)

**Implementation:**
- Single `useEffect` on `document` keydown listener
- Check `e.metaKey || e.ctrlKey` for modals
- Prevent default for handled shortcuts
- Track focused row index via `useState` for delete shortcut

---

## Task 3: Better Empty States

**Files:**
- Modify: `src/components/StatsView.tsx`
- Modify: `src/components/TimelineView.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/ChartView.tsx`
- Modify: `src/components/KanbanView.tsx`
- Modify: `styles.css`

**Implementation:**
- Add SVG icons (circle-info, calendar, chart, dashboard, kanban) to each empty state
- Add hint text explaining what to add (e.g., "Add a Status column to see stats")
- Style empty states centered with icon + title + description
- Add `.csv-db-empty-icon`, `.csv-db-empty-title`, `.csv-db-empty-desc` CSS classes

---

## Task 4: Column Width Presets

**Files:**
- Modify: `src/hooks/useColumnResize.ts`
- Modify: `src/components/TableHeader.tsx`
- Modify: `styles.css`

**Implementation:**
- Double-click resize handle → auto-fit: measure max content width of cells in that column, set as width
- Add context menu on column header: "Fit to content" and "Reset to default (180px)"
- Store a `minWidth` of 80px, `maxWidth` of 500px for auto-fit
- Use `document.querySelectorAll` to measure cell text widths during auto-fit

---

## Task 5: Multi-Select Keyboard Navigation

**Files:**
- Modify: `src/components/MultiSelectDropdown.tsx`

**Implementation:**
- Track `focusedIndex` state (arrow up/down)
- `onKeyDown` handler: ArrowDown, ArrowUp, Enter (toggle selection), Escape (close)
- Visual highlight on focused option
- Scroll focused option into view if needed

---

## Task 6: Mobile Responsive CSS

**Files:**
- Modify: `styles.css`

**Implementation:**
- Breakpoints: 480px (phone), 768px (tablet), 1024px (desktop)
- Phone: stack toolbar vertically, full-width gallery cards, compact table cells, hide non-essential columns
- Tablet: wrap toolbar, smaller gallery grid
- Touch: add `touch-action: manipulation` on draggable elements (no touch drag implementation, just prevent zoom)
- Kanban: horizontal scroll with snap

---

## Task 7: Basic Accessibility

**Files:**
- Modify: `src/components/DatabaseTable.tsx` — table role attributes
- Modify: `src/components/TableHeader.tsx` — aria-sort
- Modify: `src/components/TableRow.tsx` — role, aria-selected
- Modify: `src/components/Cell.tsx` — role="gridcell"
- Modify: `src/components/CheckboxCell.tsx` — use `<input type="checkbox">` with aria-checked
- Modify: `src/components/MultiSelectDropdown.tsx` — aria-expanded, role="listbox"
- Modify: `src/components/RelationDropdown.tsx` — aria-expanded, role="listbox"

**Implementation:**
- Table: `role="grid"`, rows: `role="row"`, cells: `role="gridcell"`
- Sorted columns: `aria-sort="ascending"` or `"descending"`
- Checkboxes: native `<input type="checkbox">` with `aria-checked`
- Dropdowns: `aria-expanded`, `aria-haspopup="listbox"`, `role="listbox"` on option container
- Selected row: `aria-selected="true"`
- Focus ring: ensure `:focus-visible` styles exist for keyboard users

---

## Plan Completion Gate

All tasks implemented, `npm run check:baseline` green, no new runtime dependencies. Manual Obsidian smoke: undo/redo works, keyboard shortcuts fire, empty states look good, mobile doesn't break, screen reader announces basic structure.
