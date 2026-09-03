import { useEffect, useMemo, useRef, useState } from "react";
import { ColumnDef } from "../types";
import { useApp, useDatabaseModel, useDatabasePath } from "../AppContext";
import { loadRelationRecords, splitRelationValue } from "../relation-utils";
import { RelationDropdown } from "./RelationDropdown";
import { RelationPill } from "./RelationPill";

interface RelationCellProps {
  value: string;
  column: ColumnDef;
  onChange: (value: string) => void;
}

export function RelationCell({ value, column, onChange }: RelationCellProps) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const tdRef = useRef<HTMLTableCellElement>(null);
  const app = useApp();
  const databasePath = useDatabasePath();
  const databaseModel = useDatabaseModel();
  const keys = useMemo(() => splitRelationValue(value, column), [value, column]);

  useEffect(() => {
    let cancelled = false;
    void loadRelationRecords(app, column, databasePath, databaseModel).then((records) => {
      if (!cancelled) {
        setLabels(new Map(records.map((record) => [record.key, record.display])));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [app, column, databasePath, databaseModel]);

  return (
    <td
      className={`csv-db-cell${column.wrapContent ? " csv-db-cell-wrap" : ""}`}
      onClick={() => { if (!open) setOpen(true); }}
      ref={tdRef}
    >
      {keys.map((key) => (
        <RelationPill key={key} value={labels.get(key) || key} />
      ))}
      {open && tdRef.current && (
        <RelationDropdown
          column={column}
          currentValue={value}
          anchorRect={tdRef.current.getBoundingClientRect()}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  );
}
