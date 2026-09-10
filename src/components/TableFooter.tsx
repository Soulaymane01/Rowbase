import { useState, useRef, useCallback } from "react";
import { DisplayColumn } from "../types";
import { computeAggregate, getAggregateLabel } from "../query/aggregate";
import { AggregateMenu } from "./AggregateMenu";
import type { AggregateRow } from "../query/aggregate";

interface TableFooterProps {
  displayColumns: DisplayColumn[];
  rows: AggregateRow[];
  onSetAggregate: (colIdx: number, aggregate: string | undefined) => void;
}

interface MenuState {
  colIdx: number;
  anchorRect: DOMRect;
}

export function TableFooter({ displayColumns, rows, onSetAggregate }: TableFooterProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuColRef = useRef<number | null>(null);

  const openMenu = useCallback((colIdx: number, anchorRect: DOMRect) => {
    menuColRef.current = colIdx;
    setMenu({ colIdx, anchorRect });
  }, []);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const handleSelect = useCallback(
    (aggregate: string | undefined) => {
      if (menuColRef.current !== null) {
        onSetAggregate(menuColRef.current, aggregate);
      }
    },
    [onSetAggregate]
  );

  const menuColumn = menu
    ? displayColumns.find(({ dataIdx }) => dataIdx === menu.colIdx)?.col
    : null;

  return (
    <tfoot>
      <tr className="csv-db-footer-row">
        <td className="csv-db-row-select-header" />
        {displayColumns.map(({ col, dataIdx }) => {
          const aggregate = col.aggregate;
          const label = getAggregateLabel(col, aggregate);
          const value = label ? computeAggregate(rows, dataIdx, col, aggregate) : "";
          return (
            <td
              key={dataIdx}
              className={`csv-db-footer-cell${label ? " csv-db-footer-active" : ""}`}
              onClick={(e) => openMenu(dataIdx, e.currentTarget.getBoundingClientRect())}
              title="Choose a calculation"
            >
              {label ? (
                <>
                  <span className="csv-db-footer-label">{label}</span>
                  <span className="csv-db-footer-value">{value}</span>
                </>
              ) : (
                <span className="csv-db-footer-placeholder">Calculate</span>
              )}
            </td>
          );
        })}
        <td className="csv-db-cell csv-db-cell-spacer" />
      </tr>
      {menu && menuColumn && (
        <AggregateMenu
          column={menuColumn}
          current={menuColumn.aggregate}
          anchorRect={menu.anchorRect}
          onSelect={handleSelect}
          onClose={closeMenu}
        />
      )}
    </tfoot>
  );
}
