interface CheckboxCellProps {
  value: string;
  onChange: (value: string) => void;
}

export function CheckboxCell({ value, onChange }: CheckboxCellProps) {
  const checked = value === "true";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(checked ? "false" : "true");
  };

  return (
    <div
      className={`csv-db-checkbox ${checked ? "is-checked" : ""}`}
      onClick={handleClick}
    >
      {checked && <span className="csv-db-checkbox-icon">✓</span>}
    </div>
  );
}
