interface RelationPillProps {
  value: string;
  onRemove?: (e: React.MouseEvent) => void;
}

export function RelationPill({ value, onRemove }: RelationPillProps) {
  return (
    <span className={`csv-db-relation-pill${onRemove ? " csv-db-relation-pill-removable" : ""}`}>
      <span className="csv-db-relation-pill-icon">↗</span>
      <span className="csv-db-relation-pill-text">{value}</span>
      {onRemove && (
        <span
          className="csv-db-relation-pill-remove-btn"
          onClick={onRemove}
        >
          ✕
        </span>
      )}
    </span>
  );
}
