import { useState, useRef, useEffect, useCallback } from "react";
import { App, Modal } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { ViewDef, ViewLayout, ColumnDef, DisplayColumn } from "../types";
import { ColumnVisibilityEditor } from "./ColumnVisibilityEditor";

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
  onDeleteView: (index: number) => void;
  onRenameView: (index: number, name: string) => void;
  onToggleBar: () => void;
  app: App;
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
  onDeleteView,
  onRenameView,
  onToggleBar,
  app,
}: ToolbarProps) {
  const [openPopover, setOpenPopover] = useState<PopoverType>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

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
          onDeleteView={() => { setOpenPopover(null); onDeleteView(activeViewIndex); }}
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
  onDeleteView: () => void;
  onRename: () => void;
}

function ViewMenu({
  activeView,
  activeViewIndex,
  views,
  columns,
  onUpdateView,
  onAddView,
  onDeleteView,
  onRename,
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

      {/* Group by section (kanban only) */}
      {activeLayout === "kanban" && (
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
    </div>
  );
}
