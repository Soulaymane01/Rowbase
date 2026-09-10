import { useState, useRef, useEffect, useCallback } from "react";
import { App, Modal } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { ViewDef, ViewLayout, ColumnDef, DisplayColumn } from "../types";
import { ColumnVisibilityEditor } from "./ColumnVisibilityEditor";
import { ChartConfigPopover } from "./ChartConfigPopover";

class RenameViewModal extends Modal {
  private currentName: string;
  private onRename: (name: string) => void;
  private reactRoot: Root | null = null;

  constructor(app: App, currentName: string, onRename: (name: string) => void) {
    super(app);
    this.currentName = currentName;
    this.onRename = onRename;
  }

  onOpen() {
    this.titleEl.textContent = "Rename view";
    this.reactRoot = createRoot(this.contentEl);
    this.reactRoot.render(
      <RenameViewContent
        currentName={this.currentName}
        onSave={(name) => {
          this.onRename(name);
          this.close();
        }}
      />
    );
  }

  onClose() {
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.contentEl.empty();
  }
}

function RenameViewContent({ currentName, onSave }: { currentName: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(currentName);

  return (
    <>
      <div className="csv-db-modal-field">
        <label className="csv-db-modal-label">Name</label>
        <input
          className="csv-db-modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const trimmed = name.trim();
              if (trimmed) onSave(trimmed);
            }
          }}
          autoFocus
        />
      </div>
      <div className="csv-db-modal-actions">
        <button
          className="csv-db-modal-btn csv-db-modal-btn-primary"
          onClick={() => {
            const trimmed = name.trim();
            if (trimmed) onSave(trimmed);
          }}
        >
          Save
        </button>
      </div>
    </>
  );
}

interface ToolbarProps {
  activeView: ViewDef;
  activeViewIndex: number;
  views: ViewDef[];
  columns: ColumnDef[];
  allDisplayColumns: DisplayColumn[];
  onUpdateView: (viewIndex: number, view: ViewDef) => void;
  onAddView: () => void;
  onDuplicateView: () => void;
  onDeleteView: (index: number) => void;
  onRenameView: (index: number, name: string) => void;
  onToggleBar: () => void;
  app: App;
  onPickRandomNote?: () => void;
  onImportCSV?: (mode: "new" | "append") => void;
  onExport?: (format: "csv" | "json") => void;
}

type PopoverType = "visibility" | "viewMenu" | null;

export function Toolbar({
  activeView,
  activeViewIndex,
  views,
  columns,
  allDisplayColumns,
  onUpdateView,
  onAddView,
  onDuplicateView,
  onDeleteView,
  onRenameView,
  onToggleBar,
  app,
  onPickRandomNote,
  onImportCSV,
  onExport,
}: ToolbarProps) {
  const [openPopover, setOpenPopover] = useState<PopoverType>(null);
  const [chartConfigOpen, setChartConfigOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const chartSettingsRef = useRef<HTMLDivElement>(null);

  const activeLayout: ViewLayout = activeView.layout || "table";

  // Close chart config popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!chartConfigOpen) return;
    const doc = activeDocument;
    const handleClick = (e: MouseEvent) => {
      if (chartSettingsRef.current && !chartSettingsRef.current.contains(e.target as Node)) {
        setChartConfigOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChartConfigOpen(false);
    };
    doc.addEventListener("mousedown", handleClick);
    doc.addEventListener("keydown", handleKey);
    return () => {
      doc.removeEventListener("mousedown", handleClick);
      doc.removeEventListener("keydown", handleKey);
    };
  }, [chartConfigOpen]);

  // Close popover when clicking outside
  useEffect(() => {
    if (openPopover === null) return;
    const doc = activeDocument;
    const handleClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPopover(null);
    };
    doc.addEventListener("mousedown", handleClick);
    doc.addEventListener("keydown", handleKey);
    return () => {
      doc.removeEventListener("mousedown", handleClick);
      doc.removeEventListener("keydown", handleKey);
    };
  }, [openPopover]);

  // Close popover when view changes
  useEffect(() => {
    setOpenPopover(null);
    setChartConfigOpen(false);
  }, [activeViewIndex]);

  const togglePopover = useCallback((type: PopoverType) => {
    setOpenPopover((prev) => (prev === type ? null : type));
  }, []);

  const hasSorts = activeView.sorts.length > 0;
  const hasFilters = activeView.filters.length > 0;

  return (
    <div className="csv-db-toolbar" ref={toolbarRef}>
      <button
        className={`csv-db-toolbar-btn${hasFilters ? " csv-db-toolbar-btn-active" : ""}`}
        onClick={onToggleBar}
        title="Filter"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="1" y1="3" x2="13" y2="3" />
          <line x1="3" y1="7" x2="11" y2="7" />
          <line x1="5" y1="11" x2="9" y2="11" />
        </svg>
      </button>
      <button
        className={`csv-db-toolbar-btn${hasSorts ? " csv-db-toolbar-btn-active" : ""}`}
        onClick={onToggleBar}
        title="Sort"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10V2M4 10L2 8M4 10L6 8" />
          <path d="M10 4V12M10 4L8 6M10 4L12 6" />
        </svg>
      </button>
      <div className="csv-db-toolbar-separator" />
      <button
        className={`csv-db-toolbar-btn${activeView.hiddenColumns.length > 0 ? " csv-db-toolbar-btn-active" : ""}`}
        onClick={() => togglePopover("visibility")}
        title="Fields"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      </button>
      <div className="csv-db-toolbar-separator" />
      <button
        className="csv-db-toolbar-btn"
        onClick={() => onPickRandomNote?.()}
        title="Pick random row"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" />
          <circle cx="4.7" cy="4.7" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="9.3" cy="9.3" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <div className="csv-db-toolbar-separator" />
      <button
        className="csv-db-toolbar-btn"
        onClick={() => togglePopover("viewMenu")}
        title="View options"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="3" cy="7" r="1.2" />
          <circle cx="7" cy="7" r="1.2" />
          <circle cx="11" cy="7" r="1.2" />
        </svg>
      </button>

      {/* Chart settings trigger (chart layout only) */}
      {activeLayout === "chart" && (
        <div className="csv-db-toolbar-chart-anchor" ref={chartSettingsRef}>
          <button
            className="csv-db-toolbar-btn"
            onClick={() => setChartConfigOpen((v) => !v)}
            title="Chart settings"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 13V3M2 13H10M2 8H6M2 4H4" />
              <circle cx="9" cy="6" r="0.8" />
              <circle cx="11" cy="8" r="0.8" />
              <circle cx="12" cy="5" r="0.8" />
            </svg>
          </button>
          {chartConfigOpen && (
            <ChartConfigPopover
              activeView={activeView}
              columns={columns}
              onUpdateView={(view) => onUpdateView(activeViewIndex, view)}
              onClose={() => setChartConfigOpen(false)}
            />
          )}
        </div>
      )}

      {/* Popovers */}
      {openPopover === "visibility" && (
        <ColumnVisibilityEditor
          activeView={activeView}
          allDisplayColumns={allDisplayColumns}
          onUpdateHiddenColumns={(hiddenColumns) => onUpdateView(activeViewIndex, { ...activeView, hiddenColumns })}
        />
      )}
      {openPopover === "viewMenu" && (
        <ViewMenu
          activeView={activeView}
          activeViewIndex={activeViewIndex}
          views={views}
          columns={columns}
          onUpdateView={onUpdateView}
          onAddView={() => { setOpenPopover(null); onAddView(); }}
          onDuplicateView={() => { setOpenPopover(null); onDuplicateView(); }}
          onDeleteView={() => { setOpenPopover(null); onDeleteView(activeViewIndex); }}
          onRequestClose={() => setOpenPopover(null)}
          onImportCSV={onImportCSV}
          onExport={onExport}
          onRename={() => {
            setOpenPopover(null);
            new RenameViewModal(app, activeView.name, (name) => {
              onRenameView(activeViewIndex, name);
            }).open();
          }}
        />
      )}
    </div>
  );
}

// --- View Menu Component ---

interface ViewMenuProps {
  activeView: ViewDef;
  activeViewIndex: number;
  views: ViewDef[];
  columns: ColumnDef[];
  onUpdateView: (viewIndex: number, view: ViewDef) => void;
  onAddView: () => void;
  onDuplicateView: () => void;
  onDeleteView: () => void;
  onRename: () => void;
  onRequestClose: () => void;
  onImportCSV?: (mode: "new" | "append") => void;
  onExport?: (format: "csv" | "json") => void;
}

function ViewMenu({
  activeView,
  activeViewIndex,
  views,
  columns,
  onUpdateView,
  onAddView,
  onDuplicateView,
  onDeleteView,
  onRename,
  onRequestClose,
  onImportCSV,
  onExport,
}: ViewMenuProps) {
  const activeLayout: ViewLayout = activeView.layout || "table";
  const selectColumns = columns.filter((c) => c.type === "select");

  const setLayout = (layout: ViewLayout) => {
    onUpdateView(activeViewIndex, { ...activeView, layout: layout === "table" ? undefined : layout });
  };

  const setGroupByColumn = (colName: string | undefined) => {
    onUpdateView(activeViewIndex, { ...activeView, groupByColumn: colName });
  };

  return (
    <div className="csv-db-popover csv-db-view-menu" onClick={(e) => e.stopPropagation()}>
      {/* Layout section */}
      <div className="csv-db-view-menu-section-label">Layout</div>
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("table")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "table" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}Table
      </div>
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("kanban")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "kanban" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}Board
      </div>
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("list")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "list" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}List
      </div>
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("gallery")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "gallery" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}Gallery
      </div>
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("chart")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "chart" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}Chart
      </div>
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("stats")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "stats" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}Stats
      </div>
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("timeline")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "timeline" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}Timeline
      </div>
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("dashboard")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "dashboard" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}Dashboard
      </div>

      {/* Group by section (kanban & list) */}
      {(activeLayout === "kanban" || activeLayout === "list") && (
        <>
          <div className="csv-db-view-menu-separator" />
          <div className="csv-db-view-menu-section-label">Group by</div>
          {selectColumns.length === 0 ? (
            <div className="csv-db-view-menu-item csv-db-view-menu-item-dim">No select columns</div>
          ) : (
            selectColumns.map((col) => (
              <div
                key={col.name}
                className="csv-db-view-menu-item"
                onClick={() => setGroupByColumn(activeView.groupByColumn === col.name ? undefined : col.name)}
              >
                <span className="csv-db-view-menu-check">
                  {activeView.groupByColumn === col.name ? "✓" : "\u00A0\u00A0"}
                </span>
                {" "}{col.name}
              </div>
            ))
          )}
        </>
      )}

      {/* Standard view actions */}
      <div className="csv-db-view-menu-separator" />
      <div className="csv-db-view-menu-item" onClick={onAddView}>
        New view
      </div>
      <div className="csv-db-view-menu-item" onClick={onDuplicateView}>
        Duplicate "{activeView.name}"
      </div>
      <div className="csv-db-view-menu-item" onClick={onRename}>
        Rename
      </div>
      {views.length > 1 && (
        <div
          className="csv-db-view-menu-item csv-db-view-menu-item-danger"
          onClick={onDeleteView}
        >
          Delete "{activeView.name}"
        </div>
      )}

      {/* Data section */}
      <div className="csv-db-view-menu-separator" />
      <div className="csv-db-view-menu-section-label">Import</div>
      <div className="csv-db-view-menu-item" onClick={() => { onRequestClose(); onImportCSV?.("new"); }}>
        CSV → New database
      </div>
      <div className="csv-db-view-menu-item" onClick={() => { onRequestClose(); onImportCSV?.("append"); }}>
        CSV → Append to current
      </div>
      <div className="csv-db-view-menu-separator" />
      <div className="csv-db-view-menu-section-label">Export</div>
      <div className="csv-db-view-menu-item" onClick={() => { onRequestClose(); onExport?.("csv"); }}>
        Export as CSV
      </div>
      <div className="csv-db-view-menu-item" onClick={() => { onRequestClose(); onExport?.("json"); }}>
        Export as JSON
      </div>
    </div>
  );
}
