interface NewRowButtonProps {
  onAddRow: () => void;
}

export function NewRowButton({ onAddRow }: NewRowButtonProps) {
  return (
    <div className="csv-db-new-row" onClick={onAddRow}>
      <span className="csv-db-new-row-icon">+</span>
      <span className="csv-db-new-row-text">New</span>
    </div>
  );
}
