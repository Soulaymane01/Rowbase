import { ViewDef, DisplayColumn } from "../types";
import { getTypeIconElement } from "./TypeIcon";

interface ColumnVisibilityEditorProps {
  activeView: ViewDef;
  allDisplayColumns: DisplayColumn[];
  onUpdateHiddenColumns: (hiddenColumns: string[]) => void;
}

export function ColumnVisibilityEditor({
  activeView,
  allDisplayColumns,
  onUpdateHiddenColumns,
}: ColumnVisibilityEditorProps) {
  const toggle = (colName: string) => {
    const isHidden = activeView.hiddenColumns.includes(colName);
    if (isHidden) {
      onUpdateHiddenColumns(activeView.hiddenColumns.filter((c) => c !== colName));
    } else {
      onUpdateHiddenColumns([...activeView.hiddenColumns, colName]);
    }
  };

  return (
    <div className="csv-db-popover csv-db-visibility-editor" onClick={(e) => e.stopPropagation()}>
      <div className="csv-db-visibility-list">
        {allDisplayColumns.map(({ col }) => {
          const isVisible = !activeView.hiddenColumns.includes(col.name);
          return (
            <div
              key={col.name}
              className="csv-db-visibility-item"
              onClick={() => toggle(col.name)}
            >
              <span className="csv-db-visibility-icon">{getTypeIconElement(col.type)}</span>
              <span className="csv-db-visibility-name">{col.name}</span>
              <span className={`csv-db-visibility-toggle${isVisible ? " csv-db-visibility-toggle-on" : ""}`}>
                <span className="csv-db-visibility-toggle-knob" />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
