import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { App, Modal } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { ColumnDef, DatabaseModel, DisplayColumn, SelectOption } from "../types";
import { splitMultiSelect, joinMultiSelect } from "../csv-parser";
import { AppContext, DatabaseModelContext, DatabasePathContext, PortalContainerContext, useApp, useDatabaseModel, useDatabasePath } from "../AppContext";
import { Tag } from "./Tag";
import { CheckboxCell } from "./CheckboxCell";
import { SelectDropdown } from "./SelectDropdown";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import { NoteDropdown } from "./NoteDropdown";
import { RelationDropdown } from "./RelationDropdown";
import { RelationPill } from "./RelationPill";
import { getTypeIconElement } from "./TypeIcon";
import { getNoteDisplayName, notePathExists, openNoteValue } from "../note-utils";
import { loadRelationRecords, splitRelationValue } from "../relation-utils";
import { openTitleNote, titleNoteExists } from "../title-utils";

interface RowDetailFieldProps {
  col: ColumnDef;
  dataIdx: number;
  value: string;
  rowOriginalIndex: number;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => string;
  onAddSelectOption: (colIdx: number, option: SelectOption) => void;
  onUpdateSelectOption: (colIdx: number, oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (colIdx: number, value: string) => void;
}

function RowDetailField({
  col,
  dataIdx,
  value,
  rowOriginalIndex,
  onSetCell,
  onAddSelectOption,
  onUpdateSelectOption,
  onRemoveOptionDef,
}: RowDetailFieldProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const selectAnchorRef = useRef<HTMLDivElement>(null);
  const app = useApp();
  const databasePath = useDatabasePath();
  const databaseModel = useDatabaseModel();
  const [relationLabels, setRelationLabels] = useState<Map<string, string>>(new Map());
  const relationKeys = useMemo(() => splitRelationValue(value, col), [value, col]);

  useEffect(() => {
    if (col.type !== "relation") return;

    let cancelled = false;
    void loadRelationRecords(app, col, databasePath, databaseModel).then((records) => {
      if (!cancelled) {
        setRelationLabels(new Map(records.map((record) => [record.key, record.display])));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [app, col, databasePath, databaseModel]);

  const handleTextCommit = useCallback((newValue: string) => {
    if (newValue !== value) {
      onSetCell(rowOriginalIndex, dataIdx, newValue);
    }
  }, [value, rowOriginalIndex, dataIdx, onSetCell]);

  const getAnchorRect = (): DOMRect | null => {
    return selectAnchorRef.current?.getBoundingClientRect() ?? null;
  };

  const renderValue = () => {
    switch (col.type) {
      case "text":
      case "title":
      case "number":
      case "date": {
        if (col.type === "title") {
          const linkToNote = col.titleNoteEnabled !== false;
          const exists = linkToNote && titleNoteExists(app, value, col, databasePath);
          const handleOpen = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (value) {
              void openTitleNote(app, value, col, databasePath);
            }
          };
          return (
            <div className="csv-db-row-detail-note">
              <input
                key={value}
                className="csv-db-row-detail-input"
                type="text"
                defaultValue={value}
                placeholder="Empty"
                onBlur={(e) => handleTextCommit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              {value && linkToNote && (
                <button
                  className={`csv-db-note-open-btn${exists ? "" : " is-create"}`}
                  onClick={handleOpen}
                >
                  {exists ? "OPEN" : "CREATE"}
                </button>
              )}
            </div>
          );
        }
        return (
          <input
            className="csv-db-row-detail-input"
            type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
            defaultValue={value}
            placeholder="Empty"
            onBlur={(e) => handleTextCommit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        );
      }

      case "checkbox": {
        return (
          <CheckboxCell
            value={value}
            onChange={(v) => onSetCell(rowOriginalIndex, dataIdx, v)}
          />
        );
      }

      case "select": {
        const opt = value ? col.options?.find((o) => o.value === value) : null;
        const anchorRect = getAnchorRect();
        return (
          <div
            ref={selectAnchorRef}
            className="csv-db-row-detail-select-trigger"
            onClick={() => { if (!selectOpen) setSelectOpen(true); }}
          >
            {opt ? (
              <Tag value={opt.value} color={opt.color || "gray"} />
            ) : (
              <span className="csv-db-row-detail-empty">Empty</span>
            )}
            {selectOpen && anchorRect && (
              <SelectDropdown
                column={col}
                currentValue={value}
                anchorRect={anchorRect}
                onSelect={(v) => {
                  onSetCell(rowOriginalIndex, dataIdx, v);
                  setSelectOpen(false);
                }}
                onCreateOption={(option) => onAddSelectOption(dataIdx, option)}
                onUpdateOption={(oldValue, newOption) => onUpdateSelectOption(dataIdx, oldValue, newOption)}
                onRemoveOptionDef={(v) => onRemoveOptionDef(dataIdx, v)}
                onClose={() => setSelectOpen(false)}
              />
            )}
          </div>
        );
      }

      case "multiselect": {
        const values = splitMultiSelect(value);
        const anchorRect = getAnchorRect();
        return (
          <div
            ref={selectAnchorRef}
            className="csv-db-row-detail-select-trigger"
            onClick={() => { if (!selectOpen) setSelectOpen(true); }}
          >
            {values.length > 0 ? (
              values.map((v) => {
                const opt = col.options?.find((o) => o.value === v);
                return <Tag key={v} value={v} color={opt?.color || "gray"} />;
              })
            ) : (
              <span className="csv-db-row-detail-empty">Empty</span>
            )}
            {selectOpen && anchorRect && (
              <MultiSelectDropdown
                column={col}
                currentValues={values}
                anchorRect={anchorRect}
                onCommit={(newValues) => {
                  onSetCell(rowOriginalIndex, dataIdx, joinMultiSelect(newValues));
                }}
                onCreateOption={(option) => onAddSelectOption(dataIdx, option)}
                onUpdateOption={(oldValue, newOption) => onUpdateSelectOption(dataIdx, oldValue, newOption)}
                onRemoveOptionDef={(v) => onRemoveOptionDef(dataIdx, v)}
                onClose={() => setSelectOpen(false)}
              />
            )}
          </div>
        );
      }

      case "note": {
        const anchorRect = getAnchorRect();
        const displayName = value ? getNoteDisplayName(value) : null;
        const exists = notePathExists(app, value);
        const handleOpen = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (value) {
            void openNoteValue(app, value);
          }
        };
        return (
          <div
            ref={selectAnchorRef}
            className="csv-db-row-detail-note"
            onClick={() => { if (!selectOpen) setSelectOpen(true); }}
          >
            {displayName ? (
              <>
                <span>{displayName}</span>
                <button
                  className={`csv-db-note-open-btn${exists ? "" : " is-create"}`}
                  onClick={handleOpen}
                >
                  {exists ? "OPEN" : "CREATE"}
                </button>
              </>
            ) : (
              <span className="csv-db-row-detail-empty">Empty</span>
            )}
            {selectOpen && anchorRect && (
              <NoteDropdown
                currentValue={value}
                anchorRect={anchorRect}
                onSelect={(v) => {
                  onSetCell(rowOriginalIndex, dataIdx, v);
                  setSelectOpen(false);
                }}
                onClose={() => setSelectOpen(false)}
              />
            )}
          </div>
        );
      }

      case "relation": {
        const anchorRect = getAnchorRect();
        return (
          <div
            ref={selectAnchorRef}
            className="csv-db-row-detail-select-trigger"
            onClick={() => { if (!selectOpen) setSelectOpen(true); }}
          >
            {relationKeys.length > 0 ? (
              relationKeys.map((key) => (
                <RelationPill key={key} value={relationLabels.get(key) || key} />
              ))
            ) : (
              <span className="csv-db-row-detail-empty">Empty</span>
            )}
            {selectOpen && anchorRect && (
              <RelationDropdown
                column={col}
                currentValue={value}
                anchorRect={anchorRect}
                onChange={(v) => onSetCell(rowOriginalIndex, dataIdx, v)}
                onClose={() => setSelectOpen(false)}
              />
            )}
          </div>
        );
      }

      default:
        return <span>{value}</span>;
    }
  };

  return (
    <div className="csv-db-row-detail-field">
      <div className="csv-db-row-detail-label">
        <span className="csv-db-row-detail-label-icon">{getTypeIconElement(col.type)}</span>
        <span>{col.name}</span>
      </div>
      <div className="csv-db-row-detail-value">
        {renderValue()}
      </div>
    </div>
  );
}

interface RowDetailModalContentProps {
  row: string[];
  rowOriginalIndex: number;
  allDisplayColumns: DisplayColumn[];
  onSetCell: (rowIdx: number, colIdx: number, value: string) => string;
  onAddSelectOption: (colIdx: number, option: SelectOption) => void;
  onUpdateSelectOption: (colIdx: number, oldValue: string, newOption: SelectOption | null) => void;
  onRemoveOptionDef: (colIdx: number, value: string) => void;
}

function RowDetailModalContent({
  row,
  rowOriginalIndex,
  allDisplayColumns,
  onSetCell,
  onAddSelectOption,
  onUpdateSelectOption,
  onRemoveOptionDef,
}: RowDetailModalContentProps) {
  const [values, setValues] = useState([...row]);
  const [localColumns, setLocalColumns] = useState<DisplayColumn[]>(
    allDisplayColumns.map(dc => ({
      ...dc,
      col: { ...dc.col, options: dc.col.options ? [...dc.col.options] : undefined }
    }))
  );

  const handleSetCell = useCallback((rowIdx: number, colIdx: number, value: string) => {
    const nextValue = onSetCell(rowIdx, colIdx, value);
    setValues((prev) => {
      const next = [...prev];
      next[colIdx] = nextValue;
      return next;
    });
    return nextValue;
  }, [onSetCell]);

  const updateLocalColumnOptions = useCallback(
    (dataIdx: number, updater: (options: SelectOption[]) => SelectOption[]) => {
      setLocalColumns(prev =>
        prev.map(dc =>
          dc.dataIdx === dataIdx
            ? { ...dc, col: { ...dc.col, options: updater(dc.col.options || []) } }
            : dc
        )
      );
    },
    []
  );

  const handleAddSelectOption = useCallback((colIdx: number, option: SelectOption) => {
    updateLocalColumnOptions(colIdx, opts => [...opts, option]);
    onAddSelectOption(colIdx, option);
  }, [onAddSelectOption, updateLocalColumnOptions]);

  const handleUpdateSelectOption = useCallback((colIdx: number, oldValue: string, newOption: SelectOption | null) => {
    updateLocalColumnOptions(colIdx, opts => {
      if (newOption === null) {
        return opts.filter(o => o.value !== oldValue);
      }
      return opts.map(o => o.value === oldValue ? newOption : o);
    });

    if (newOption === null) {
      // Delete: clear value from local row
      const col = allDisplayColumns.find(dc => dc.dataIdx === colIdx)?.col;
      setValues(prev => {
        const next = [...prev];
        if (col?.type === "multiselect") {
          const current = splitMultiSelect(next[colIdx]);
          next[colIdx] = joinMultiSelect(current.filter(v => v !== oldValue));
        } else {
          if (next[colIdx] === oldValue) {
            next[colIdx] = "";
          }
        }
        return next;
      });
    } else if (newOption.value !== oldValue) {
      // Rename: update value in local row
      const col = allDisplayColumns.find(dc => dc.dataIdx === colIdx)?.col;
      setValues(prev => {
        const next = [...prev];
        if (col?.type === "multiselect") {
          const current = splitMultiSelect(next[colIdx]);
          next[colIdx] = joinMultiSelect(current.map(v => v === oldValue ? newOption.value : v));
        } else {
          if (next[colIdx] === oldValue) {
            next[colIdx] = newOption.value;
          }
        }
        return next;
      });
    }

    onUpdateSelectOption(colIdx, oldValue, newOption);
  }, [onUpdateSelectOption, updateLocalColumnOptions, allDisplayColumns]);

  const handleRemoveOptionDef = useCallback((colIdx: number, value: string) => {
    updateLocalColumnOptions(colIdx, opts => opts.filter(o => o.value !== value));
    onRemoveOptionDef(colIdx, value);
  }, [onRemoveOptionDef, updateLocalColumnOptions]);

  return (
    <div className="csv-db-row-detail">
      {localColumns.map(({ col, dataIdx }) => (
        <RowDetailField
          key={col.name}
          col={col}
          dataIdx={dataIdx}
          value={values[dataIdx]}
          rowOriginalIndex={rowOriginalIndex}
          onSetCell={handleSetCell}
          onAddSelectOption={handleAddSelectOption}
          onUpdateSelectOption={handleUpdateSelectOption}
          onRemoveOptionDef={handleRemoveOptionDef}
        />
      ))}
    </div>
  );
}

export class RowDetailModalWrapper extends Modal {
  private row: string[];
  private rowOriginalIndex: number;
  private allDisplayColumns: DisplayColumn[];
  private onSetCellCallback: (rowIdx: number, colIdx: number, value: string) => string;
  private onAddSelectOptionCallback: (colIdx: number, option: SelectOption) => void;
  private onUpdateSelectOptionCallback: (colIdx: number, oldValue: string, newOption: SelectOption | null) => void;
  private onRemoveOptionDefCallback: (colIdx: number, value: string) => void;
  private databasePath: string;
  private model: DatabaseModel;
  private reactRoot: Root | null = null;

  constructor(
    app: App,
    row: string[],
    rowOriginalIndex: number,
    allDisplayColumns: DisplayColumn[],
    onSetCell: (rowIdx: number, colIdx: number, value: string) => string,
    onAddSelectOption: (colIdx: number, option: SelectOption) => void,
    onUpdateSelectOption: (colIdx: number, oldValue: string, newOption: SelectOption | null) => void,
    onRemoveOptionDef: (colIdx: number, value: string) => void,
    databasePath: string,
    model: DatabaseModel,
  ) {
    super(app);
    this.row = row;
    this.rowOriginalIndex = rowOriginalIndex;
    this.allDisplayColumns = allDisplayColumns;
    this.onSetCellCallback = onSetCell;
    this.onAddSelectOptionCallback = onAddSelectOption;
    this.onUpdateSelectOptionCallback = onUpdateSelectOption;
    this.onRemoveOptionDefCallback = onRemoveOptionDef;
    this.databasePath = databasePath;
    this.model = model;
  }

  onOpen() {
    this.modalEl.addClass("csv-db-row-detail-modal");
    this.reactRoot = createRoot(this.contentEl);
    this.reactRoot.render(
      <AppContext.Provider value={this.app}>
        <DatabasePathContext.Provider value={this.databasePath}>
          <DatabaseModelContext.Provider value={this.model}>
            <PortalContainerContext.Provider value={this.containerEl}>
              <RowDetailModalContent
                row={this.row}
                rowOriginalIndex={this.rowOriginalIndex}
                allDisplayColumns={this.allDisplayColumns}
                onSetCell={this.onSetCellCallback}
                onAddSelectOption={this.onAddSelectOptionCallback}
                onUpdateSelectOption={this.onUpdateSelectOptionCallback}
                onRemoveOptionDef={this.onRemoveOptionDefCallback}
              />
            </PortalContainerContext.Provider>
          </DatabaseModelContext.Provider>
        </DatabasePathContext.Provider>
      </AppContext.Provider>
    );
  }

  onClose() {
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.contentEl.empty();
  }
}
