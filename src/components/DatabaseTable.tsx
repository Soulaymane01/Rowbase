import { useReducer, useEffect, useRef, useCallback, useMemo, useState } from "react";
import { App } from "obsidian";
import { DatabaseModel, ColumnDef, ColumnType, SelectOption, DisplayColumn, ViewDef, SortRule, FilterRule } from "../types";
import { splitMultiSelect, joinMultiSelect } from "../csv-parser";
import { splitRelationValue } from "../relation-utils";
import { TableHeader } from "./TableHeader";
import { TableBody } from "./TableBody";
import { NewRowButton } from "./NewRowButton";
import { ViewBar } from "./ViewBar";
import { Toolbar } from "./Toolbar";
import { FilterSortBar } from "./FilterSortBar";
import { ColumnModalWrapper } from "./ColumnModal";
import { RowDetailModalWrapper } from "./RowDetailModal";
import { useColumnResize } from "../hooks/useColumnResize";
import { useColumnDrag } from "../hooks/useColumnDrag";
import { KanbanView } from "./KanbanView";
import { AppContext, DatabaseModelContext, DatabasePathContext } from "../AppContext";

type Action =
  | { type: "SET_MODEL"; model: DatabaseModel; fromExternal?: boolean }
  | { type: "SET_CELL"; rowIdx: number; colIdx: number; value: string }
  | { type: "ADD_ROW" }
  | { type: "ADD_ROW_WITH_VALUES"; values: { colIdx: number; value: string }[] }
  | { type: "DELETE_ROW"; rowIdx: number }
  | { type: "REORDER_ROW"; fromRowIdx: number; toRowIdx: number; position: "before" | "after" }
  | { type: "ADD_COLUMN"; column: ColumnDef }
  | { type: "DELETE_COLUMN"; colIdx: number }
  | { type: "UPDATE_COLUMN"; colIdx: number; name: string; colType: ColumnType; options: SelectOption[]; wrapContent: boolean; titleNoteEnabled: boolean; titleNoteFolder: string; relationTargetPath: string; relationMultiple: boolean }
  | { type: "SET_COLUMN_WIDTH"; colIdx: number; width: number }
  | { type: "ADD_SELECT_OPTION"; colIdx: number; option: SelectOption }
  | { type: "UPDATE_SELECT_OPTION"; colIdx: number; oldValue: string; newOption: SelectOption | null }
  | { type: "REMOVE_OPTION_DEF"; colIdx: number; value: string }
  | { type: "REORDER_COLUMN"; dataIdx1: number; dataIdx2: number }
  | { type: "ADD_VIEW" }
  | { type: "ADD_VIEW_FROM_DRAFT"; sorts: SortRule[]; filters: FilterRule[]; sourceView: ViewDef }
  | { type: "DELETE_VIEW"; viewIndex: number }
  | { type: "UPDATE_VIEW"; viewIndex: number; view: ViewDef };

function ensureUniqueColumnName(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) return name;
  let i = 2;
  while (existingNames.includes(`${name} ${i}`)) i++;
  return `${name} ${i}`;
}

function updateViewReferences(views: ViewDef[], oldName: string, newName: string): ViewDef[] {
  return views.map((view) => ({
    ...view,
    sorts: view.sorts.map((s) =>
      s.column === oldName ? { ...s, column: newName } : s
    ),
    filters: view.filters.map((f) =>
      f.column === oldName ? { ...f, column: newName } : f
    ),
    hiddenColumns: view.hiddenColumns.map((c) =>
      c === oldName ? newName : c
    ),
    groupByColumn: view.groupByColumn === oldName ? newName : view.groupByColumn,
  }));
}

function removeColumnFromViews(views: ViewDef[], columnName: string): ViewDef[] {
  return views.map((view) => ({
    ...view,
    sorts: view.sorts.filter((s) => s.column !== columnName),
    filters: view.filters.filter((f) => f.column !== columnName),
    hiddenColumns: view.hiddenColumns.filter((c) => c !== columnName),
    groupByColumn: view.groupByColumn === columnName ? undefined : view.groupByColumn,
  }));
}

function ensureUniqueTitleValue(value: string, rows: string[][], colIdx: number, rowIdx: number): string {
  if (!value) return value;

  const existing = new Set(
    rows
      .filter((_, i) => i !== rowIdx)
      .map((row) => row[colIdx])
      .filter(Boolean)
  );
  if (!existing.has(value)) return value;

  let i = 2;
  while (existing.has(`${value} ${i}`)) i++;
  return `${value} ${i}`;
}

function ensureUniqueTitleRows(rows: string[][], colIdx: number): string[][] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const value = row[colIdx];
    if (!value) return row;

    let uniqueValue = value;
    let i = 2;
    while (seen.has(uniqueValue)) {
      uniqueValue = `${value} ${i}`;
      i++;
    }
    seen.add(uniqueValue);

    if (uniqueValue === value) return row;
    return row.map((cell, ci) => (ci === colIdx ? uniqueValue : cell));
  });
}

function databaseReducer(state: DatabaseModel, action: Action): DatabaseModel {
  switch (action.type) {
    case "SET_MODEL":
      return action.model;

    case "SET_CELL": {
      const column = state.columns[action.colIdx];
      const value = column?.type === "title"
        ? ensureUniqueTitleValue(action.value, state.rows, action.colIdx, action.rowIdx)
        : action.value;
      const rows = state.rows.map((row, ri) =>
        ri === action.rowIdx
          ? row.map((cell, ci) => (ci === action.colIdx ? value : cell))
          : row
      );
      return { ...state, rows };
    }

    case "ADD_ROW": {
      const emptyRow = Array.from({ length: state.columns.length }, () => "");
      return { ...state, rows: [...state.rows, emptyRow] };
    }

    case "ADD_ROW_WITH_VALUES": {
      const newRow = Array.from({ length: state.columns.length }, () => "");
      for (const { colIdx, value } of action.values) {
        if (colIdx >= 0 && colIdx < newRow.length) {
          newRow[colIdx] = state.columns[colIdx].type === "title"
            ? ensureUniqueTitleValue(value, state.rows, colIdx, -1)
            : value;
        }
      }
      return { ...state, rows: [...state.rows, newRow] };
    }

    case "DELETE_ROW": {
      const rows = state.rows.filter((_, i) => i !== action.rowIdx);
      return { ...state, rows };
    }

    case "REORDER_ROW": {
      const { fromRowIdx, toRowIdx, position } = action;
      if (fromRowIdx === toRowIdx) return state;

      const movingRow = state.rows[fromRowIdx];
      if (!movingRow || !state.rows[toRowIdx]) return state;

      const rows = state.rows.filter((_, i) => i !== fromRowIdx);
      const targetIdx = rows.indexOf(state.rows[toRowIdx]);
      const insertIdx = position === "after" ? targetIdx + 1 : targetIdx;
      rows.splice(insertIdx, 0, movingRow);

      return { ...state, rows };
    }

    case "ADD_COLUMN": {
      const maxColumnIndex = state.columns.reduce(
        (max, col) => Math.max(max, col.columnIndex ?? 0),
        -1
      );
      const existingNames = state.columns.map((c) => c.name);
      const uniqueName = ensureUniqueColumnName(action.column.name, existingNames);
      const columns = [...state.columns, { ...action.column, name: uniqueName, columnIndex: maxColumnIndex + 1 }];
      const rows = state.rows.map((row) => [...row, ""]);
      return { ...state, columns, rows };
    }

    case "DELETE_COLUMN": {
      const deletedColumnName = state.columns[action.colIdx].name;
      const deletedColumnIndex = state.columns[action.colIdx].columnIndex!;
      const columns = state.columns
        .filter((_, i) => i !== action.colIdx)
        .map((col) => ({
          ...col,
          columnIndex: col.columnIndex! > deletedColumnIndex ? col.columnIndex! - 1 : col.columnIndex!,
        }));
      const rows = state.rows.map((row) => row.filter((_, i) => i !== action.colIdx));
      const views = removeColumnFromViews(state.views, deletedColumnName);
      return { columns, rows, views, formatVersion: state.formatVersion };
    }

    case "UPDATE_COLUMN": {
      const oldName = state.columns[action.colIdx].name;
      let newName = action.name || "Untitled";

      // Ensure unique name (excluding the column being updated)
      const otherNames = state.columns.filter((_, i) => i !== action.colIdx).map((c) => c.name);
      newName = ensureUniqueColumnName(newName, otherNames);

      const columns = state.columns.map((col, i) => {
        if (i !== action.colIdx) {
          if (action.colType === "title" && col.type === "title") {
            const updated = { ...col, type: "text" as const };
            delete updated.titleNoteEnabled;
            delete updated.titleNoteFolder;
            return updated;
          }
          return col;
        }
        const updated: ColumnDef = {
          ...col,
          name: newName,
          type: action.colType,
          wrapContent: action.wrapContent || undefined,
        };
        if (action.colType === "select" || action.colType === "multiselect") {
          updated.options = action.options.filter((o) => o.value.trim() !== "");
        } else {
          delete updated.options;
        }
        if (action.colType === "title") {
          updated.titleNoteEnabled = action.titleNoteEnabled;
          updated.titleNoteFolder = action.titleNoteFolder || undefined;
        } else {
          delete updated.titleNoteEnabled;
          delete updated.titleNoteFolder;
        }
        if (action.colType === "relation") {
          updated.relationTargetPath = action.relationTargetPath || undefined;
          updated.relationMultiple = action.relationMultiple || undefined;
        } else {
          delete updated.relationTargetPath;
          delete updated.relationMultiple;
        }
        return updated;
      });

      // Propagate column rename to views
      const views = oldName !== newName
        ? updateViewReferences(state.views, oldName, newName)
        : state.views;

      const rows = action.colType === "title"
        ? ensureUniqueTitleRows(state.rows, action.colIdx)
        : state.rows;

      return { ...state, columns, rows, views };
    }

    case "REMOVE_OPTION_DEF": {
      const columns = state.columns.map((col, i) => {
        if (i !== action.colIdx) return col;
        return { ...col, options: (col.options || []).filter((o) => o.value !== action.value) };
      });
      return { ...state, columns };
    }

    case "SET_COLUMN_WIDTH": {
      const columns = state.columns.map((col, i) =>
        i === action.colIdx ? { ...col, width: action.width } : col
      );
      return { ...state, columns };
    }

    case "ADD_SELECT_OPTION": {
      const columns = state.columns.map((col, i) => {
        if (i !== action.colIdx) return col;
        const options = [...(col.options || []), action.option];
        return { ...col, options };
      });
      return { ...state, columns };
    }

    case "UPDATE_SELECT_OPTION": {
      const { colIdx, oldValue, newOption } = action;
      const col = state.columns[colIdx];
      const colType = col.type;

      // Update column options
      let newOptions: SelectOption[];
      if (newOption === null) {
        // Delete
        newOptions = (col.options || []).filter((o) => o.value !== oldValue);
      } else {
        newOptions = (col.options || []).map((o) =>
          o.value === oldValue ? newOption : o
        );
      }
      const columns = state.columns.map((c, i) =>
        i === colIdx ? { ...c, options: newOptions } : c
      );

      // Update row data if renamed or deleted
      const renamed = newOption !== null && newOption.value !== oldValue;
      const deleted = newOption === null;
      if (!renamed && !deleted) {
        return { ...state, columns };
      }

      const rows = state.rows.map((row) => {
        const cell = row[colIdx];
        if (!cell) return row;

        let newCell: string;
        if (colType === "multiselect") {
          const parts = splitMultiSelect(cell);
          const updated = deleted
            ? parts.filter((p) => p !== oldValue)
            : parts.map((p) => (p === oldValue ? newOption.value : p));
          newCell = joinMultiSelect(updated);
        } else {
          if (cell === oldValue) {
            newCell = deleted ? "" : newOption.value;
          } else {
            newCell = cell;
          }
        }

        if (newCell === cell) return row;
        return row.map((c, ci) => (ci === colIdx ? newCell : c));
      });

      return { columns, rows, views: state.views, formatVersion: state.formatVersion };
    }

    case "REORDER_COLUMN": {
      const { dataIdx1, dataIdx2 } = action;
      const ci1 = state.columns[dataIdx1].columnIndex!;
      const ci2 = state.columns[dataIdx2].columnIndex!;
      const columns = state.columns.map((col, i) => {
        if (i === dataIdx1) return { ...col, columnIndex: ci2 };
        if (i === dataIdx2) return { ...col, columnIndex: ci1 };
        return col;
      });
      return { ...state, columns };
    }

    case "ADD_VIEW": {
      const existingNames = state.views.map((v) => v.name);
      let name = "New View";
      if (existingNames.includes(name)) {
        let i = 2;
        while (existingNames.includes(`${name} ${i}`)) i++;
        name = `${name} ${i}`;
      }
      const newView: ViewDef = { name, sorts: [], filters: [], hiddenColumns: [] };
      return { ...state, views: [...state.views, newView] };
    }

    case "ADD_VIEW_FROM_DRAFT": {
      const existingNames = state.views.map((v) => v.name);
      let name = "New View";
      if (existingNames.includes(name)) {
        let i = 2;
        while (existingNames.includes(`${name} ${i}`)) i++;
        name = `${name} ${i}`;
      }
      const newView: ViewDef = {
        name,
        layout: action.sourceView.layout,
        sorts: action.sorts,
        filters: action.filters,
        hiddenColumns: [...action.sourceView.hiddenColumns],
        groupByColumn: action.sourceView.groupByColumn,
      };
      return { ...state, views: [...state.views, newView] };
    }

    case "DELETE_VIEW": {
      if (state.views.length <= 1) return state;
      const views = state.views.filter((_, i) => i !== action.viewIndex);
      return { ...state, views };
    }

    case "UPDATE_VIEW": {
      const views = state.views.map((v, i) =>
        i === action.viewIndex ? action.view : v
      );
      return { ...state, views };
    }

    default:
      return state;
  }
}

function applyFilters(
  rows: string[][],
  filters: ViewDef["filters"],
  columns: ColumnDef[]
): Array<{ row: string[]; originalIndex: number }> {
  const indexed = rows.map((row, i) => ({ row, originalIndex: i }));
  if (filters.length === 0) return indexed;

  return indexed.filter(({ row }) => {
    return filters.every((filter) => {
      const colIdx = columns.findIndex((c) => c.name === filter.column);
      if (colIdx === -1) return true;
      const cell = row[colIdx] || "";
      const colType = columns[colIdx].type;

      switch (filter.operator) {
        case "is-empty":
          return cell === "";
        case "is-not-empty":
          return cell !== "";
        case "contains": {
          if (filter.value.length === 0) return true;
          if (colType === "multiselect" || colType === "relation") {
            const cellValues = splitMultiSelect(cell);
            const values = colType === "relation"
              ? splitRelationValue(cell, columns[colIdx])
              : cellValues;
            return filter.value.some((v) => values.includes(v));
          }
          if (colType === "select") {
            return filter.value.includes(cell);
          }
          // text, number, date
          return filter.value.some((v) => cell.toLowerCase().includes(v.toLowerCase()));
        }
        case "does-not-contain": {
          if (filter.value.length === 0) return true;
          if (colType === "multiselect" || colType === "relation") {
            const values = colType === "relation"
              ? splitRelationValue(cell, columns[colIdx])
              : splitMultiSelect(cell);
            return !filter.value.some((v) => values.includes(v));
          }
          if (colType === "select") {
            return !filter.value.includes(cell);
          }
          return !filter.value.some((v) => cell.toLowerCase().includes(v.toLowerCase()));
        }
        default:
          return true;
      }
    });
  });
}

function applySorts(
  rows: Array<{ row: string[]; originalIndex: number }>,
  sorts: ViewDef["sorts"],
  columns: ColumnDef[]
): Array<{ row: string[]; originalIndex: number }> {
  if (sorts.length === 0) return rows;

  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const sort of sorts) {
      const colIdx = columns.findIndex((c) => c.name === sort.column);
      if (colIdx === -1) continue;

      const colType = columns[colIdx].type;
      const cellA = a.row[colIdx] || "";
      const cellB = b.row[colIdx] || "";

      let cmp = 0;
      if (colType === "number") {
        const numA = parseFloat(cellA);
        const numB = parseFloat(cellB);
        if (isNaN(numA) && isNaN(numB)) cmp = 0;
        else if (isNaN(numA)) cmp = -1;
        else if (isNaN(numB)) cmp = 1;
        else cmp = numA - numB;
      } else if (colType === "checkbox") {
        const boolA = cellA === "true" ? 1 : 0;
        const boolB = cellB === "true" ? 1 : 0;
        cmp = boolA - boolB;
      } else {
        // text, select, date, multiselect — locale string compare
        cmp = cellA.localeCompare(cellB);
      }

      if (cmp !== 0) {
        return sort.direction === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });

  return sorted;
}

interface DatabaseTableProps {
  initialModel: DatabaseModel;
  onModelChange: (model: DatabaseModel) => void;
  setModelSetter: (setter: (model: DatabaseModel) => void) => void;
  app: App;
  databasePath: string;
}

export function DatabaseTable({
  initialModel,
  onModelChange,
  setModelSetter,
  app,
  databasePath,
}: DatabaseTableProps) {
  const [model, dispatch] = useReducer(databaseReducer, initialModel);
  const isExternalUpdate = useRef(false);
  const prevModelRef = useRef(model);
  const [activeViewIndex, setActiveViewIndex] = useState(0);

  // FilterSortBar state
  const [barVisible, setBarVisible] = useState(false);
  const [draftSorts, setDraftSorts] = useState<SortRule[]>([]);
  const [draftFilters, setDraftFilters] = useState<FilterRule[]>([]);
  const draftStateMapRef = useRef<Map<number, { sorts: SortRule[]; filters: FilterRule[] }>>(new Map());

  // Ensure activeViewIndex is valid
  const safeViewIndex = (activeViewIndex >= 0 && activeViewIndex < model.views.length) ? activeViewIndex : 0;
  const activeView = model.views[safeViewIndex];

  // Determine if draft differs from saved view
  const isDirty = useMemo(() => {
    if (!barVisible) return false;
    return JSON.stringify(draftSorts) !== JSON.stringify(activeView.sorts) ||
      JSON.stringify(draftFilters) !== JSON.stringify(activeView.filters);
  }, [barVisible, draftSorts, draftFilters, activeView.sorts, activeView.filters]);

  // Compute display order: columns sorted by columnIndex
  const allDisplayColumns: DisplayColumn[] = useMemo(
    () =>
      model.columns
        .map((col, i) => ({ col, dataIdx: i }))
        .sort((a, b) => (a.col.columnIndex ?? 0) - (b.col.columnIndex ?? 0)),
    [model.columns]
  );

  // Filter out hidden columns for the active view
  const displayColumns: DisplayColumn[] = useMemo(
    () => allDisplayColumns.filter(({ col }) => !activeView.hiddenColumns.includes(col.name)),
    [allDisplayColumns, activeView.hiddenColumns]
  );

  // Compute filtered and sorted rows — use draft state when bar is visible
  const effectiveSorts = barVisible ? draftSorts : activeView.sorts;
  const effectiveFilters = barVisible ? draftFilters : activeView.filters;

  const filteredSortedRows = useMemo(() => {
    const filtered = applyFilters(model.rows, effectiveFilters, model.columns);
    return applySorts(filtered, effectiveSorts, model.columns);
  }, [model.rows, model.columns, effectiveFilters, effectiveSorts]);

  // Ref for stable access in callbacks
  const displayColumnsRef = useRef(displayColumns);
  displayColumnsRef.current = displayColumns;

  // Register setter for external model pushes (from setViewData)
  useEffect(() => {
    setModelSetter((newModel: DatabaseModel) => {
      isExternalUpdate.current = true;
      dispatch({ type: "SET_MODEL", model: newModel });
    });
  }, [setModelSetter]);

  // Notify parent of changes (skip external updates to avoid write-back loop)
  useEffect(() => {
    if (isExternalUpdate.current) {
      isExternalUpdate.current = false;
      prevModelRef.current = model;
      return;
    }
    if (model !== prevModelRef.current) {
      prevModelRef.current = model;
      onModelChange(model);
    }
  }, [model, onModelChange]);

  // Preserve draft state when switching views
  const handleSwitchView = useCallback((index: number) => {
    if (barVisible) {
      // Save current view's draft
      draftStateMapRef.current.set(safeViewIndex, { sorts: draftSorts, filters: draftFilters });
      // Load new view's draft or initialize from saved state
      const savedDraft = draftStateMapRef.current.get(index);
      const targetView = model.views[index >= 0 && index < model.views.length ? index : 0];
      if (savedDraft) {
        setDraftSorts(savedDraft.sorts);
        setDraftFilters(savedDraft.filters);
      } else {
        setDraftSorts(targetView.sorts.map((s) => ({ ...s })));
        setDraftFilters(targetView.filters.map((f) => ({ ...f, value: [...f.value] })));
      }
    }
    setActiveViewIndex(index);
  }, [barVisible, safeViewIndex, draftSorts, draftFilters, model.views]);

  // Toggle bar visibility
  const handleToggleBar = useCallback(() => {
    if (barVisible) {
      // Only close if not dirty
      if (!isDirty) {
        draftStateMapRef.current.clear();
        setBarVisible(false);
      }
    } else {
      // Open: initialize draft from active view
      setDraftSorts(activeView.sorts.map((s) => ({ ...s })));
      setDraftFilters(activeView.filters.map((f) => ({ ...f, value: [...f.value] })));
      setBarVisible(true);
    }
  }, [barVisible, isDirty, activeView.sorts, activeView.filters]);

  // Bar action handlers
  const handleBarReset = useCallback(() => {
    draftStateMapRef.current.clear();
    setBarVisible(false);
  }, []);

  const handleBarSave = useCallback(() => {
    dispatch({
      type: "UPDATE_VIEW",
      viewIndex: safeViewIndex,
      view: { ...activeView, sorts: draftSorts, filters: draftFilters },
    });
    draftStateMapRef.current.clear();
    setBarVisible(false);
  }, [safeViewIndex, activeView, draftSorts, draftFilters]);

  const handleBarSaveAsNewView = useCallback(() => {
    dispatch({
      type: "ADD_VIEW_FROM_DRAFT",
      sorts: draftSorts,
      filters: draftFilters,
      sourceView: activeView,
    });
    draftStateMapRef.current.clear();
    setBarVisible(false);
    setActiveViewIndex(model.views.length); // switch to new view
  }, [draftSorts, draftFilters, activeView, model.views.length]);

  // Propagate column renames/deletions to draft state
  const prevColumnsRef = useRef(model.columns);
  useEffect(() => {
    if (!barVisible) {
      prevColumnsRef.current = model.columns;
      return;
    }
    const prev = prevColumnsRef.current;
    const curr = model.columns;
    prevColumnsRef.current = curr;

    if (prev === curr) return;

    // Detect renames: same length, find name changes by matching columnIndex
    if (prev.length === curr.length) {
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].name !== curr[i].name) {
          const oldName = prev[i].name;
          const newName = curr[i].name;
          setDraftSorts((s) => s.map((r) => r.column === oldName ? { ...r, column: newName } : r));
          setDraftFilters((f) => f.map((r) => r.column === oldName ? { ...r, column: newName } : r));
        }
      }
    }

    // Detect deletions: column names that disappeared
    const currNames = new Set(curr.map((c) => c.name));
    const deletedNames = prev.map((c) => c.name).filter((n) => !currNames.has(n));
    if (deletedNames.length > 0) {
      setDraftSorts((s) => s.filter((r) => !deletedNames.includes(r.column)));
      setDraftFilters((f) => f.filter((r) => !deletedNames.includes(r.column)));
    }
  }, [model.columns, barVisible]);

  const handleResizeEnd = useCallback((displayIdx: number, width: number) => {
    const dataIdx = displayColumnsRef.current[displayIdx].dataIdx;
    dispatch({ type: "SET_COLUMN_WIDTH", colIdx: dataIdx, width });
  }, []);

  const { colGroupRef, tableRef, onResizeStart, consumeJustResized } =
    useColumnResize({ onResizeEnd: handleResizeEnd });

  const handleReorderColumn = useCallback((fromDisplayIdx: number, toDisplayIdx: number) => {
    const dc = displayColumnsRef.current;
    const insertIdx = toDisplayIdx > fromDisplayIdx ? toDisplayIdx - 1 : toDisplayIdx;
    const dataIdx1 = dc[fromDisplayIdx].dataIdx;
    const dataIdx2 = dc[insertIdx].dataIdx;
    dispatch({ type: "REORDER_COLUMN", dataIdx1, dataIdx2 });
  }, []);

  const { dragState, onDragStart, consumeJustDragged } =
    useColumnDrag({ onReorder: handleReorderColumn, tableRef });

  const handleSetCell = useCallback((rowIdx: number, colIdx: number, value: string) => {
    const column = model.columns[colIdx];
    const nextValue = column?.type === "title"
      ? ensureUniqueTitleValue(value, model.rows, colIdx, rowIdx)
      : value;
    dispatch({ type: "SET_CELL", rowIdx, colIdx, value: nextValue });
    return nextValue;
  }, [model.columns, model.rows]);

  const handleDeleteRow = useCallback((rowIdx: number) => {
    dispatch({ type: "DELETE_ROW", rowIdx });
  }, []);

  const handleReorderRow = useCallback((fromRowIdx: number, toRowIdx: number, position: "before" | "after") => {
    dispatch({ type: "REORDER_ROW", fromRowIdx, toRowIdx, position });
  }, []);

  const handleAddRow = useCallback(() => {
    dispatch({ type: "ADD_ROW" });
  }, []);

  const handleAddRowWithValues = useCallback((values: { colIdx: number; value: string }[]) => {
    dispatch({ type: "ADD_ROW_WITH_VALUES", values });
  }, []);

  const handleAddColumn = useCallback(() => {
    dispatch({ type: "ADD_COLUMN", column: { name: "New Column", type: "text" } });
  }, []);

  const handleAddSelectOption = useCallback((colIdx: number, option: SelectOption) => {
    dispatch({ type: "ADD_SELECT_OPTION", colIdx, option });
  }, []);

  const handleUpdateSelectOption = useCallback((colIdx: number, oldValue: string, newOption: SelectOption | null) => {
    dispatch({ type: "UPDATE_SELECT_OPTION", colIdx, oldValue, newOption });
  }, []);

  const handleRemoveOptionDef = useCallback((colIdx: number, value: string) => {
    dispatch({ type: "REMOVE_OPTION_DEF", colIdx, value });
  }, []);

  const handleColumnClick = useCallback(
    (dataIdx: number) => {
      const col = model.columns[dataIdx];
      const modal = new ColumnModalWrapper(
        app,
        col,
        model.columns,
        databasePath,
        (name, colType, options, wrapContent, titleNoteEnabled, titleNoteFolder, relationTargetPath, relationMultiple) => {
          dispatch({ type: "UPDATE_COLUMN", colIdx: dataIdx, name, colType, options, wrapContent, titleNoteEnabled, titleNoteFolder, relationTargetPath, relationMultiple });
        },
        () => {
          dispatch({ type: "DELETE_COLUMN", colIdx: dataIdx });
        },
        (value, removeData) => {
          if (removeData) {
            dispatch({ type: "UPDATE_SELECT_OPTION", colIdx: dataIdx, oldValue: value, newOption: null });
          } else {
            dispatch({ type: "REMOVE_OPTION_DEF", colIdx: dataIdx, value });
          }
        }
      );
      modal.open();
    },
    [app, model.columns]
  );

  const handleCardClick = useCallback((rowOriginalIndex: number) => {
    const row = model.rows[rowOriginalIndex];
    if (!row) return;
    const modal = new RowDetailModalWrapper(
      app, row, rowOriginalIndex, allDisplayColumns,
      handleSetCell, handleAddSelectOption, handleUpdateSelectOption, handleRemoveOptionDef,
      databasePath,
      model,
    );
    modal.open();
  }, [app, model, allDisplayColumns, handleSetCell, handleAddSelectOption, handleUpdateSelectOption, handleRemoveOptionDef, databasePath]);

  // View management handlers
  const handleAddView = useCallback(() => {
    dispatch({ type: "ADD_VIEW" });
    setBarVisible(false);
    setActiveViewIndex(model.views.length); // switch to the newly added view
  }, [model.views.length]);

  const handleDeleteView = useCallback((viewIndex: number) => {
    dispatch({ type: "DELETE_VIEW", viewIndex });
    setBarVisible(false);
    if (viewIndex < activeViewIndex) {
      setActiveViewIndex(activeViewIndex - 1);
    } else if (viewIndex === activeViewIndex) {
      setActiveViewIndex(Math.max(0, viewIndex - 1));
    }
  }, [activeViewIndex]);

  const handleUpdateView = useCallback((viewIndex: number, view: ViewDef) => {
    dispatch({ type: "UPDATE_VIEW", viewIndex, view });
  }, []);

  // Compute total table width from display order
  let totalWidth = 0;
  for (const { col } of displayColumns) {
    totalWidth += col.width ?? 180;
  }
  totalWidth += 32; // add-column button width

  const activeLayout = activeView.layout || "table";
  const canReorderRows = effectiveSorts.length === 0;

  return (
    <AppContext.Provider value={app}>
      <DatabasePathContext.Provider value={databasePath}>
        <DatabaseModelContext.Provider value={model}>
      <div className="csv-db-viewbar">
        <ViewBar
          views={model.views}
          activeViewIndex={safeViewIndex}
          onSwitchView={handleSwitchView}
        />
        <Toolbar
          activeView={activeView}
          activeViewIndex={safeViewIndex}
          views={model.views}
          columns={model.columns}
          allDisplayColumns={allDisplayColumns}
          onUpdateView={handleUpdateView}
          onAddView={handleAddView}
          onDeleteView={handleDeleteView}
          onRenameView={(viewIndex, name) => {
            const view = model.views[viewIndex];
            handleUpdateView(viewIndex, { ...view, name });
          }}
          onToggleBar={handleToggleBar}
          app={app}
        />
      </div>
      {barVisible && (
        <FilterSortBar
          draftSorts={draftSorts}
          draftFilters={draftFilters}
          columns={model.columns}
          isDirty={isDirty}
          onUpdateSorts={setDraftSorts}
          onUpdateFilters={setDraftFilters}
          onReset={handleBarReset}
          onSave={handleBarSave}
          onSaveAsNewView={handleBarSaveAsNewView}
        />
      )}
      {activeLayout === "table" ? (
        <div className="csv-db-scroll-area">
          <div className="csv-db-wrapper">
            <table
              className="csv-db-table"
              ref={tableRef}
              style={{ width: `${totalWidth}px` }}
            >
              <colgroup ref={colGroupRef}>
                <col style={{ width: "0px" }} />
                {displayColumns.map(({ col }, i) => (
                  <col key={i} style={{ width: `${col.width ?? 180}px` }} />
                ))}
                <col style={{ width: "32px" }} />
              </colgroup>
              <TableHeader
                displayColumns={displayColumns}
                onResizeStart={onResizeStart}
                consumeJustResized={consumeJustResized}
                onAddColumn={handleAddColumn}
                onColumnClick={handleColumnClick}
                onDragStart={onDragStart}
                consumeJustDragged={consumeJustDragged}
                dragState={dragState}
              />
              <TableBody
                rows={filteredSortedRows}
                displayColumns={displayColumns}
                onSetCell={handleSetCell}
                onDeleteRow={handleDeleteRow}
                onReorderRow={handleReorderRow}
                canReorderRows={canReorderRows}
                onAddSelectOption={handleAddSelectOption}
                onUpdateSelectOption={handleUpdateSelectOption}
                onRemoveOptionDef={handleRemoveOptionDef}
              />
            </table>
            <NewRowButton onAddRow={handleAddRow} />
          </div>
        </div>
      ) : (
        <KanbanView
          rows={filteredSortedRows}
          columns={model.columns}
          displayColumns={displayColumns}
          activeView={activeView}
          onSetCell={handleSetCell}
          onDeleteRow={handleDeleteRow}
          onAddRowWithValues={handleAddRowWithValues}
          onCardClick={handleCardClick}
        />
      )}
        </DatabaseModelContext.Provider>
      </DatabasePathContext.Provider>
    </AppContext.Provider>
  );
}
