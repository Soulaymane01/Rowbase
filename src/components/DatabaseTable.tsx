import { useReducer, useEffect, useRef, useCallback, useMemo, useState } from "react";
import { App } from "obsidian";
import { DatabaseModel, ColumnDef, ColumnType, SelectOption, DisplayColumn, ViewDef, SortRule, FilterRule } from "../types";
import { splitMultiSelect, joinMultiSelect } from "../csv-parser";
import { runQuery } from "../query";
import { createRelationResolver, preloadRelationTargets } from "../relation-resolver";
import { TableHeader } from "./TableHeader";
import { TableBody } from "./TableBody";
import { TableFooter } from "./TableFooter";
import { NewRowButton } from "./NewRowButton";
import { ViewBar } from "./ViewBar";
import { Toolbar } from "./Toolbar";
import { FilterSortBar } from "./FilterSortBar";
import { ColumnModalWrapper } from "./ColumnModal";
import { RowDetailModalWrapper } from "./RowDetailModal";
import { useColumnResize } from "../hooks/useColumnResize";
import { useColumnDrag } from "../hooks/useColumnDrag";
import { KanbanView } from "./KanbanView";
import { ListView } from "./ListView";
import { GalleryView } from "./GalleryView";
import { ChartView } from "./ChartView";
import { StatsView } from "./StatsView";
import { TimelineView } from "./TimelineView";
import { DashboardView } from "./DashboardView";
import { AppContext, DatabaseModelContext, DatabasePathContext } from "../AppContext";
import { parsePlainCSV, inferColumns, exportToPlainCSV, exportToJSON } from "../import-export";
import { Notice, normalizePath, Events } from "obsidian";
import { serializeCSV } from "../csv-parser";
import { openNoteValue } from "../note-utils";
import { openTitleNote } from "../title-utils";
import type DatabasePlugin from "../main";
import { SETTINGS_CHANGED_EVENT } from "../main";

type Action =
  | { type: "SET_MODEL"; model: DatabaseModel; fromExternal?: boolean }
  | { type: "SET_CELL"; rowIdx: number; colIdx: number; value: string }
  | { type: "SET_CELLS"; updates: { rowIdx: number; colIdx: number; value: string }[] }
  | { type: "ADD_ROW" }
  | { type: "ADD_ROW_WITH_VALUES"; values: { colIdx: number; value: string }[] }
  | { type: "DELETE_ROW"; rowIdx: number }
  | { type: "DELETE_ROWS"; rowIdxs: number[] }
  | { type: "REORDER_ROW"; fromRowIdx: number; toRowIdx: number; position: "before" | "after" }
  | { type: "ADD_COLUMN"; column: ColumnDef }
  | { type: "DELETE_COLUMN"; colIdx: number }
  | { type: "UPDATE_COLUMN"; colIdx: number; name: string; colType: ColumnType; options: SelectOption[]; wrapContent: boolean; titleNoteEnabled: boolean; titleNoteFolder: string; titleFolderEnabled: boolean; titleFolderPath: string; relationTargetPath: string; relationMultiple: boolean; formula?: string; rollup?: ColumnDef["rollup"]; progressStyle?: "bar" | "ring" }
  | { type: "SET_COLUMN_WIDTH"; colIdx: number; width: number }
  | { type: "SET_COLUMN_AGGREGATE"; colIdx: number; aggregate?: string }
  | { type: "ADD_SELECT_OPTION"; colIdx: number; option: SelectOption }
  | { type: "REORDER_SELECT_OPTION"; colIdx: number; fromIdx: number; insertAt: number }
  | { type: "UPDATE_SELECT_OPTION"; colIdx: number; oldValue: string; newOption: SelectOption | null }
  | { type: "REMOVE_OPTION_DEF"; colIdx: number; value: string }
  | { type: "REORDER_COLUMN"; dataIdx1: number; dataIdx2: number }
  | { type: "ADD_VIEW" }
  | { type: "ADD_VIEW_COPY"; sourceIndex: number }
  | { type: "ADD_VIEW_FROM_DRAFT"; sorts: SortRule[]; filters: FilterRule[]; sourceView: ViewDef }
  | { type: "DELETE_VIEW"; viewIndex: number }
  | { type: "UPDATE_VIEW"; viewIndex: number; view: ViewDef }
  | { type: "UNDO" }
  | { type: "REDO" };

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

interface HistoryState {
  past: DatabaseModel[];
  present: DatabaseModel;
  future: DatabaseModel[];
}

const MAX_HISTORY = 100;

function withHistory(reducer: (state: DatabaseModel, action: Action) => DatabaseModel) {
  return function historyReducer(state: HistoryState, action: Action): HistoryState {
    switch (action.type) {
      case "UNDO": {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        return {
          past: state.past.slice(0, -1),
          present: previous,
          future: [state.present, ...state.future],
        };
      }
      case "REDO": {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        return {
          past: [...state.past, state.present],
          present: next,
          future: state.future.slice(1),
        };
      }
      default: {
        const newPresent = reducer(state.present, action);
        if (newPresent === state.present) return state;
        const past = state.past.length >= MAX_HISTORY
          ? [...state.past.slice(1), state.present]
          : [...state.past, state.present];
        return { past, present: newPresent, future: [] };
      }
    }
  };
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

    case "SET_CELLS": {
      if (action.updates.length === 0) return state;
      let anyChange = false;
      const rows = state.rows.map((row, ri) => {
        const updates = action.updates.filter((u) => u.rowIdx === ri);
        if (updates.length === 0) return row;
        let changed = false;
        const next = row.map((cell, ci) => {
          const u = updates.find((x) => x.colIdx === ci);
          if (u && u.value !== cell) {
            changed = true;
            return u.value;
          }
          return cell;
        });
        if (!changed) return row;
        anyChange = true;
        return next;
      });
      return anyChange ? { ...state, rows } : state;
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

    case "DELETE_ROWS": {
      if (action.rowIdxs.length === 0) return state;
      const toDelete = new Set(action.rowIdxs);
      const rows = state.rows.filter((_, i) => !toDelete.has(i));
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
            delete updated.titleFolderEnabled;
            delete updated.titleFolderPath;
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
          updated.titleFolderEnabled = action.titleFolderEnabled || undefined;
          updated.titleFolderPath = action.titleFolderPath || undefined;
        } else {
          delete updated.titleNoteEnabled;
          delete updated.titleNoteFolder;
          delete updated.titleFolderEnabled;
          delete updated.titleFolderPath;
        }
        if (action.colType === "relation") {
          updated.relationTargetPath = action.relationTargetPath || undefined;
          updated.relationMultiple = action.relationMultiple || undefined;
        } else {
          delete updated.relationTargetPath;
          delete updated.relationMultiple;
        }
        if (action.colType === "formula") {
          updated.formula = action.formula || undefined;
        } else {
          delete updated.formula;
        }
        if (action.colType === "rollup") {
          updated.rollup = action.rollup;
        } else {
          delete updated.rollup;
        }
        if (action.colType === "progress") {
          updated.progressStyle = action.progressStyle === "ring" ? "ring" : "bar";
        } else {
          delete updated.progressStyle;
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

    case "SET_COLUMN_AGGREGATE": {
      const columns = state.columns.map((col, i) => {
        if (i !== action.colIdx) return col;
        return { ...col, aggregate: action.aggregate };
      });
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

    case "REORDER_SELECT_OPTION": {
      const col = state.columns[action.colIdx];
      if (!col?.options) return state;
      const options = [...col.options];
      const [moved] = options.splice(action.fromIdx, 1);
      if (!moved) return state;
      const insertAt = Math.max(0, Math.min(options.length, action.insertAt));
      options.splice(insertAt, 0, moved);
      const columns = state.columns.map((c, i) =>
        i === action.colIdx ? { ...c, options } : c
      );
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

      // Propagate to hidden board groups of views grouped by this column
      const views = state.views.map((view) => {
        if (view.groupByColumn !== col.name) return view;
        const hidden = (view.hiddenGroups ?? [])
          .map((h) => {
            if (h !== oldValue) return h;
            if (deleted || !newOption) return null;
            return newOption.value;
          })
          .filter((h): h is string => h !== null);
        return { ...view, hiddenGroups: hidden.length > 0 ? Array.from(new Set(hidden)) : undefined };
      });

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

      return { columns, rows, views, formatVersion: state.formatVersion };
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

    case "ADD_VIEW_COPY": {
      const source = state.views[action.sourceIndex];
      if (!source) return state;
      const existingNames = state.views.map((v) => v.name);
      const base = `${source.name} copy`;
      let name = base;
      let i = 2;
      while (existingNames.includes(name)) {
        name = `${base} ${i}`;
        i++;
      }
      const copy: ViewDef = {
        ...source,
        name,
        sorts: source.sorts.map((s) => ({ ...s })),
        filters: source.filters.map((f) => ({ ...f, value: [...f.value] })),
        hiddenColumns: [...source.hiddenColumns],
      };
      return { ...state, views: [...state.views, copy] };
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

interface DatabaseTableProps {
  initialModel: DatabaseModel;
  onModelChange: (model: DatabaseModel) => void;
  setModelSetter: (setter: (model: DatabaseModel) => void) => void;
  app: App;
  databasePath: string;
  plugin?: DatabasePlugin | null;
}

export function DatabaseTable({
  initialModel,
  onModelChange,
  setModelSetter,
  app,
  databasePath,
  plugin,
}: DatabaseTableProps) {
  const historyReducer = useMemo(() => withHistory(databaseReducer), []);
  const [history, rawDispatch] = useReducer(historyReducer, {
    past: [],
    present: initialModel,
    future: [],
  });
  const model = history.present;

  const dispatch = useCallback((action: Action) => {
    rawDispatch(action);
  }, [rawDispatch]);

  const isExternalUpdate = useRef(false);
  const prevModelRef = useRef(model);
  const [activeViewIndex, setActiveViewIndex] = useState(0);

  // FilterSortBar state
  const [barVisible, setBarVisible] = useState(false);
  const [draftSorts, setDraftSorts] = useState<SortRule[]>([]);
  const [draftFilters, setDraftFilters] = useState<FilterRule[]>([]);
  const draftStateMapRef = useRef<Map<number, { sorts: SortRule[]; filters: FilterRule[] }>>(new Map());

  // Row selection (multi-row operations)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Per-column search
  const [openSearchColumns, setOpenSearchColumns] = useState<Set<string>>(new Set());
  const [columnSearch, setColumnSearch] = useState<Record<string, string>>({});
  const [searchFocusColumn, setSearchFocusColumn] = useState<string | null>(null);

  // Re-render when plugin settings change (e.g. row numbers toggle)
  const [, setSettingsTick] = useState(0);
  useEffect(() => {
    const events = app.workspace as unknown as Events;
    const ref = events.on(SETTINGS_CHANGED_EVENT, () => setSettingsTick((t) => t + 1));
    return () => events.offref(ref);
  }, [app]);

  const showRowNumbers = plugin?.settings.showRowNumbers === true;

  // Ensure activeViewIndex is valid
  const safeViewIndex = (activeViewIndex >= 0 && activeViewIndex < model.views.length) ? activeViewIndex : 0;
  const activeView = model.views[safeViewIndex];

  // Relation resolver — preload targets, then pass to runQuery
  const [relationReady, setRelationReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void preloadRelationTargets(app, databasePath, model.columns).then(() => {
      if (!cancelled) setRelationReady(true);
    });
    return () => { cancelled = true; };
  }, [app, databasePath, model.columns]);

  const resolveRelation = useMemo(
    () => createRelationResolver(app, databasePath, model),
    [app, databasePath, model],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      } else if (mod && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        dispatch({ type: "ADD_ROW" });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

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
    return runQuery(model, { ...activeView, sorts: effectiveSorts, filters: effectiveFilters }, resolveRelation);
  }, [model, activeView, effectiveSorts, effectiveFilters, resolveRelation, relationReady]);

  // Apply per-column search on top of the query result
  const searchedRows = useMemo(() => {
    if (openSearchColumns.size === 0) return filteredSortedRows;
    const terms = Array.from(openSearchColumns)
      .map((name) => [name, (columnSearch[name] ?? "").trim().toLowerCase()] as const)
      .filter(([, term]) => term !== "");
    if (terms.length === 0) return filteredSortedRows;
    return filteredSortedRows.filter((r) =>
      terms.every(([name, term]) => {
        const idx = model.columns.findIndex((c) => c.name === name);
        if (idx === -1) return true;
        const cell = (r.computed?.[idx] ?? r.row[idx] ?? "").toLowerCase();
        return cell.includes(term);
      })
    );
  }, [filteredSortedRows, openSearchColumns, columnSearch, model.columns]);

  // Prune selection when rows are removed
  useEffect(() => {
    if (selectedRows.size === 0) return;
    const valid = new Set<number>();
    selectedRows.forEach((i) => { if (i < model.rows.length) valid.add(i); });
    if (valid.size !== selectedRows.size) setSelectedRows(valid);
  }, [model.rows, selectedRows]);

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

  const { colGroupRef, tableRef, onResizeStart, consumeJustResized, fitColumnToContent } =
    useColumnResize({ onResizeEnd: handleResizeEnd });

  const handleFitToContent = useCallback((displayIdx: number) => {
    fitColumnToContent(displayIdx);
  }, [fitColumnToContent]);

  const handleResetWidth = useCallback((displayIdx: number) => {
    const dataIdx = displayColumnsRef.current[displayIdx].dataIdx;
    dispatch({ type: "SET_COLUMN_WIDTH", colIdx: dataIdx, width: 180 });
  }, []);

  const handleSetAggregate = useCallback((colIdx: number, aggregate: string | undefined) => {
    dispatch({ type: "SET_COLUMN_AGGREGATE", colIdx, aggregate });
  }, []);

  const handleReorderBoardColumn = useCallback((groupColIdx: number, fromIdx: number, insertAt: number) => {
    dispatch({ type: "REORDER_SELECT_OPTION", colIdx: groupColIdx, fromIdx, insertAt });
  }, []);

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

  const handleSetCells = useCallback((updates: { rowIdx: number; colIdx: number; value: string }[]) => {
    if (updates.length === 0) return;
    const normalized = updates.map((u) => {
      const column = model.columns[u.colIdx];
      const value = column?.type === "title"
        ? ensureUniqueTitleValue(u.value, model.rows, u.colIdx, u.rowIdx)
        : u.value;
      return { ...u, value };
    });
    dispatch({ type: "SET_CELLS", updates: normalized });
  }, [model.columns, model.rows]);

  const handleDeleteRow = useCallback((rowIdx: number) => {
    dispatch({ type: "DELETE_ROW", rowIdx });
  }, []);

  const handleToggleRowSelect = useCallback((rowIdx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIdx)) next.delete(rowIdx);
      else next.add(rowIdx);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      if (prev.size > 0) return new Set();
      return new Set(searchedRows.map((r) => r.originalIndex));
    });
  }, [searchedRows]);

  const handleDeleteSelected = useCallback(() => {
    dispatch({ type: "DELETE_ROWS", rowIdxs: Array.from(selectedRows) });
    setSelectedRows(new Set());
  }, [selectedRows]);

  const handleClearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const handlePickRandomNote = useCallback(() => {
    if (searchedRows.length === 0) {
      new Notice("No rows to pick from");
      return;
    }
    const picked = searchedRows[Math.floor(Math.random() * searchedRows.length)];
    setSelectedRows(new Set([picked.originalIndex]));

    let targetColumn: ColumnDef | null = null;
    let targetValue = "";
    for (let i = 0; i < model.columns.length; i++) {
      const col = model.columns[i];
      if (col.type !== "note") continue;
      const v = (picked.row[i] ?? "").trim();
      if (v) {
        targetColumn = col;
        targetValue = v;
        break;
      }
    }
    let pickedTitle = "";
    if (!targetColumn) {
      const titleIdx = model.columns.findIndex((c) => c.type === "title" && c.titleNoteEnabled !== false);
      if (titleIdx !== -1) {
        const v = (picked.row[titleIdx] ?? "").trim();
        if (v) {
          targetColumn = model.columns[titleIdx];
          targetValue = v;
          pickedTitle = v;
        }
      }
    } else {
      const titleIdx = model.columns.findIndex((c) => c.type === "title");
      if (titleIdx !== -1) pickedTitle = (picked.row[titleIdx] ?? "").trim();
    }

    new Notice(`Picked: ${pickedTitle || targetValue || "row"}`);
    if (targetColumn?.type === "note") {
      void openNoteValue(app, targetValue).catch((error: unknown) => {
        new Notice(`Could not open note: ${error instanceof Error ? error.message : "Unknown error"}`);
      });
    } else if (targetColumn) {
      void openTitleNote(app, targetValue, targetColumn, databasePath).catch((error: unknown) => {
        new Notice(`Could not open note: ${error instanceof Error ? error.message : "Unknown error"}`);
      });
    }
  }, [searchedRows, model.columns, app, databasePath]);

  const handleToggleSearch = useCallback((columnName: string) => {
    setOpenSearchColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnName)) {
        next.delete(columnName);
        setColumnSearch((cs) => {
          const updated = { ...cs };
          delete updated[columnName];
          return updated;
        });
      } else {
        next.add(columnName);
        setSearchFocusColumn(columnName);
      }
      return next;
    });
  }, []);

  const handleSearchChange = useCallback((columnName: string, value: string) => {
    setColumnSearch((prev) => ({ ...prev, [columnName]: value }));
  }, []);

  const handleQuickSort = useCallback((columnName: string) => {
    const baseSorts = barVisible ? draftSorts : activeView.sorts;
    const existing = baseSorts.find((s) => s.column === columnName);
    let nextSorts: SortRule[];
    if (!existing) {
      nextSorts = [...baseSorts, { column: columnName, direction: "asc" as const }];
    } else if (existing.direction === "asc") {
      nextSorts = baseSorts.map((s) => (s.column === columnName ? { ...s, direction: "desc" as const } : s));
    } else {
      nextSorts = baseSorts.filter((s) => s.column !== columnName);
    }
    if (barVisible) {
      setDraftSorts(nextSorts);
    } else {
      dispatch({ type: "UPDATE_VIEW", viewIndex: safeViewIndex, view: { ...activeView, sorts: nextSorts } });
    }
  }, [barVisible, draftSorts, activeView, safeViewIndex]);

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
        (name, colType, options, wrapContent, titleNoteEnabled, titleNoteFolder, titleFolderEnabled, titleFolderPath, relationTargetPath, relationMultiple, formula, rollup, progressStyle) => {
          dispatch({ type: "UPDATE_COLUMN", colIdx: dataIdx, name, colType, options, wrapContent, titleNoteEnabled, titleNoteFolder, titleFolderEnabled, titleFolderPath, relationTargetPath, relationMultiple, formula, rollup, progressStyle });
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

  const handleImportCSV = useCallback((mode: "new" | "append") => {
    const input = document.body.createEl("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = () => {
      void (async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const { headers, rows } = parsePlainCSV(text);
      if (headers.length === 0) { new Notice("CSV has no header"); return; }
      if (mode === "new") {
        const cols = inferColumns(headers, rows);
        const newModel: DatabaseModel = { columns: cols, rows, views: [{ name: "Default", sorts: [], filters: [], hiddenColumns: [] }], formatVersion: 1 };
        const base = file.name.replace(/\.csv$/i, "");
        const folder = databasePath.includes("/") ? databasePath.substring(0, databasePath.lastIndexOf("/")) : "";
        let path = normalizePath(folder ? `${folder}/${base}.rbase` : `${base}.rbase`);
        let i = 1;
        while (app.vault.getAbstractFileByPath(path)) { path = normalizePath(folder ? `${folder}/${base} ${i}.rbase` : `${base} ${i}.rbase`); i++; }
        await app.vault.create(path, serializeCSV(newModel));
        new Notice(`Created ${path}`);
      } else {
        const existingHeaders = model.columns.map((c) => c.name);
        const newCols = headers.filter((h) => !existingHeaders.includes(h));
        let nextModel = model;
        for (const h of newCols) {
          const inferred = inferColumns([h], rows.map((r) => [r[headers.indexOf(h)] ?? ""]))[0];
          nextModel = { ...nextModel, columns: [...nextModel.columns, { ...inferred, name: h, columnIndex: nextModel.columns.length }], rows: nextModel.rows.map((r) => [...r, ""]) };
        }
        const colIndexByName = new Map(nextModel.columns.map((c, idx) => [c.name, idx]));
        const newRows: string[][] = rows.map((r) => {
          const out: string[] = Array.from(
            { length: nextModel.columns.length },
            () => "",
          );
          headers.forEach((h, hi) => { const idx = colIndexByName.get(h); if (idx !== undefined) out[idx] = r[hi] ?? ""; });
          return out;
        });
        const merged: DatabaseModel = { ...nextModel, rows: [...nextModel.rows, ...newRows] };
        dispatch({ type: "SET_MODEL", model: merged });
        new Notice(`Appended ${rows.length} rows`);
      }
      })().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        new Notice(`Could not import CSV: ${message}`);
      });
    };
    input.click();
  }, [app, model, databasePath]);

  const handleExport = useCallback(async (format: "csv" | "json") => {
    const headers = model.columns.map((c) => c.name);
    const content = format === "csv" ? exportToPlainCSV(headers, model.rows) : exportToJSON(model.columns, model.rows);
    const ext = format === "csv" ? "csv" : "json";
    const base = databasePath.replace(/\.rbase$/i, "");
    const path = normalizePath(`${base}.${ext}`);
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing) await app.fileManager.trashFile(existing);
    await app.vault.create(path, content);
    new Notice(`Exported to ${path}`);
  }, [app, model, databasePath]);

  // View management handlers
  const handleAddView = useCallback(() => {
    dispatch({ type: "ADD_VIEW" });
    setBarVisible(false);
    setActiveViewIndex(model.views.length); // switch to the newly added view
  }, [model.views.length]);

  const handleDuplicateView = useCallback(() => {
    dispatch({ type: "ADD_VIEW_COPY", sourceIndex: safeViewIndex });
    setBarVisible(false);
    setActiveViewIndex(model.views.length); // copy is appended at the end
  }, [safeViewIndex, model.views.length]);

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

  const tableView = (
    <div className="csv-db-scroll-area">
      <div className="csv-db-wrapper">
        <table
          className="csv-db-table"
          ref={tableRef}
          style={{ width: `${totalWidth}px` }}
          role="grid"
        >
          <colgroup ref={colGroupRef}>
            <col style={{ width: "28px" }} />
            {displayColumns.map(({ col }, i) => (
              <col key={i} style={{ width: `${col.width ?? 180}px` }} />
            ))}
            <col style={{ width: "32px" }} />
          </colgroup>
          <TableHeader
            displayColumns={displayColumns}
            sorts={effectiveSorts}
            onResizeStart={onResizeStart}
            consumeJustResized={consumeJustResized}
            onAddColumn={handleAddColumn}
            onColumnClick={handleColumnClick}
            onDragStart={onDragStart}
            consumeJustDragged={consumeJustDragged}
            dragState={dragState}
            onFitToContent={handleFitToContent}
            onResetWidth={handleResetWidth}
            selectedCount={selectedRows.size}
            visibleRowCount={searchedRows.length}
            onToggleSelectAll={handleToggleSelectAll}
            onQuickSort={handleQuickSort}
            openSearchColumns={openSearchColumns}
            searchValues={columnSearch}
            searchFocusColumn={searchFocusColumn}
            onToggleSearch={handleToggleSearch}
            onSearchChange={handleSearchChange}
          />
          <TableBody
            rows={searchedRows}
            displayColumns={displayColumns}
            onSetCell={handleSetCell}
            onReorderRow={handleReorderRow}
            canReorderRows={canReorderRows}
            selectedRows={selectedRows}
            onToggleRowSelect={handleToggleRowSelect}
            showRowNumbers={showRowNumbers}
            onAddSelectOption={handleAddSelectOption}
            onUpdateSelectOption={handleUpdateSelectOption}
            onRemoveOptionDef={handleRemoveOptionDef}
          />
          <TableFooter
            displayColumns={displayColumns}
            rows={searchedRows}
            onSetAggregate={handleSetAggregate}
          />
        </table>
        <NewRowButton onAddRow={handleAddRow} />
      </div>
    </div>
  );

  return (
    <AppContext.Provider value={app}>
      <DatabasePathContext.Provider value={databasePath}>
        <DatabaseModelContext.Provider value={model}>
      <div className="csv-db-viewbar">
        <ViewBar
          views={model.views}
          activeViewIndex={safeViewIndex}
          onSwitchView={handleSwitchView}
          onAddView={handleAddView}
          onRenameView={(viewIndex, name) => {
            const view = model.views[viewIndex];
            if (view) handleUpdateView(viewIndex, { ...view, name });
          }}
        />
        <Toolbar
          activeView={activeView}
          activeViewIndex={safeViewIndex}
          views={model.views}
          columns={model.columns}
          allDisplayColumns={allDisplayColumns}
          onUpdateView={handleUpdateView}
          onAddView={handleAddView}
          onDuplicateView={handleDuplicateView}
          onDeleteView={handleDeleteView}
          onRenameView={(viewIndex, name) => {
            const view = model.views[viewIndex];
            handleUpdateView(viewIndex, { ...view, name });
          }}
          onToggleBar={handleToggleBar}
          app={app}
          onPickRandomNote={handlePickRandomNote}
          onImportCSV={handleImportCSV}
          onExport={(format) => {
            void handleExport(format).catch((error: unknown) => {
              const message = error instanceof Error ? error.message : "Unknown error";
              new Notice(`Could not export data: ${message}`);
            });
          }}
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
      {selectedRows.size > 0 && (
        <div className="csv-db-selection-bar">
          <span className="csv-db-selection-count">{selectedRows.size} selected</span>
          <button className="csv-db-selection-action csv-db-selection-delete" onClick={handleDeleteSelected}>
            Delete
          </button>
          <button className="csv-db-selection-action csv-db-selection-clear" onClick={handleClearSelection}>
            Clear
          </button>
        </div>
      )}
      {activeLayout === "table" ? (
        tableView
      ) : activeLayout === "kanban" ? (
        <KanbanView
          rows={searchedRows}
          columns={model.columns}
          displayColumns={displayColumns}
          activeView={activeView}
          onSetCell={handleSetCell}
          onDeleteRow={handleDeleteRow}
          onAddRowWithValues={handleAddRowWithValues}
          onCardClick={handleCardClick}
          onUpdateView={(view) => handleUpdateView(safeViewIndex, view)}
          onReorderBoardColumn={handleReorderBoardColumn}
        />
      ) : activeLayout === "list" ? (
        <ListView
          rows={searchedRows}
          columns={model.columns}
          displayColumns={displayColumns}
          activeView={activeView}
          onSetCell={handleSetCell}
          onDeleteRow={handleDeleteRow}
          onCardClick={handleCardClick}
          showRowNumbers={showRowNumbers}
          selectedRows={selectedRows}
          onToggleRowSelect={handleToggleRowSelect}
        />
      ) : activeLayout === "gallery" ? (
        <GalleryView
          rows={searchedRows}
          columns={model.columns}
          displayColumns={displayColumns}
          activeView={activeView}
          onSetCell={handleSetCell}
          onDeleteRow={handleDeleteRow}
          onCardClick={handleCardClick}
          selectedRows={selectedRows}
          onToggleRowSelect={handleToggleRowSelect}
        />
      ) : activeLayout === "chart" ? (
        <ChartView
          rows={searchedRows}
          columns={model.columns}
          displayColumns={displayColumns}
          activeView={activeView}
          onSetCell={handleSetCell}
          onDeleteRow={handleDeleteRow}
          onCardClick={handleCardClick}
        />
      ) : activeLayout === "stats" ? (
        <StatsView rows={searchedRows} columns={model.columns} />
      ) : activeLayout === "timeline" ? (
        <TimelineView
          rows={searchedRows}
          columns={model.columns}
          activeView={activeView}
          onCardClick={handleCardClick}
          onSetCell={handleSetCell}
          onSetCells={handleSetCells}
          onDeleteRow={handleDeleteRow}
          onUpdateView={(view) => handleUpdateView(safeViewIndex, view)}
        />
      ) : activeLayout === "dashboard" ? (
        <DashboardView rows={searchedRows} columns={model.columns} onSetCell={handleSetCell} onCardClick={handleCardClick} />
      ) : (
        tableView
      )}
        </DatabaseModelContext.Provider>
      </DatabasePathContext.Provider>
    </AppContext.Provider>
  );
}
