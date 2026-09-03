import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ColumnDef } from "../types";
import { useApp, useDatabaseModel, useDatabasePath, usePortalContainer } from "../AppContext";
import { useClickOutside } from "../hooks/useClickOutside";
import { joinRelationValue, loadRelationRecords, RelationRecord, splitRelationValue } from "../relation-utils";
import { RelationPill } from "./RelationPill";

interface RelationDropdownProps {
  column: ColumnDef;
  currentValue: string;
  anchorRect: DOMRect;
  onChange: (value: string) => void;
  onClose: () => void;
}

export function RelationDropdown({
  column,
  currentValue,
  anchorRect,
  onChange,
  onClose,
}: RelationDropdownProps) {
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<RelationRecord[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const app = useApp();
  const databasePath = useDatabasePath();
  const databaseModel = useDatabaseModel();
  const portalContainer = usePortalContainer();
  const currentKeys = splitRelationValue(currentValue, column);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useClickOutside([dropdownRef], handleClose);

  useEffect(() => {
    let cancelled = false;
    void loadRelationRecords(app, column, databasePath, databaseModel).then((nextRecords) => {
      if (!cancelled) setRecords(nextRecords);
    });
    return () => {
      cancelled = true;
    };
  }, [app, column, databasePath, databaseModel]);

  const recordByKey = useMemo(() => {
    return new Map(records.map((record) => [record.key, record]));
  }, [records]);

  const selectedRecords = currentKeys.map((key) => recordByKey.get(key) || { key, display: key });
  const lower = search.toLowerCase();
  const filtered = records.filter((record) =>
    !currentKeys.includes(record.key) &&
    (record.key.toLowerCase().includes(lower) || record.display.toLowerCase().includes(lower))
  );

  const selectRecord = (record: RelationRecord) => {
    if (column.relationMultiple) {
      onChange(joinRelationValue([...currentKeys, record.key], column));
      setSearch("");
      return;
    }
    onChange(record.key);
    onClose();
  };

  const removeRecord = (key: string) => {
    onChange(joinRelationValue(currentKeys.filter((currentKey) => currentKey !== key), column));
  };

  return createPortal(
    <div
      ref={dropdownRef}
      className="csv-db-dropdown csv-db-relation-dropdown"
      style={{
        top: `${anchorRect.top}px`,
        left: `${anchorRect.left}px`,
        width: `${anchorRect.width}px`,
      }}
    >
      <div
        className="csv-db-dropdown-input-area"
        onClick={() => {
          dropdownRef.current?.querySelector<HTMLInputElement>(".csv-db-dropdown-search")?.focus();
        }}
      >
        {selectedRecords.map((record) => (
          <RelationPill
            key={record.key}
            value={record.display}
            onRemove={(e) => {
              e.stopPropagation();
              removeRecord(record.key);
            }}
          />
        ))}
        <input
          className="csv-db-dropdown-search"
          placeholder={selectedRecords.length > 0 ? "" : "Search rows..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      </div>
      <div className="csv-db-dropdown-hint">
        {column.relationTargetPath || "Configure relation target"}
      </div>
      <div className="csv-db-dropdown-list">
        {filtered.map((record) => (
          <div
            key={record.key}
            className="csv-db-dropdown-item"
            onClick={(e) => {
              e.stopPropagation();
              selectRecord(record);
            }}
          >
            <span className="csv-db-note-item-name">{record.display}</span>
            {record.key !== record.display && (
              <span className="csv-db-note-item-path">{record.key}</span>
            )}
          </div>
        ))}
      </div>
    </div>,
    portalContainer
  );
}
