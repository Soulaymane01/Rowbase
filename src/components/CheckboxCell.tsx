import { ColumnDef } from "../types";

interface CheckboxCellProps {
  value: string;
  onChange: (value: string) => void;
  column: ColumnDef;
}

export function CheckboxCell({ value, onChange, column }: CheckboxCellProps) {
  const checked = value === "true";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onChange(checked ? "false" : "true");
  };

  return (
    <input
      type="checkbox"
      className="csv-db-checkbox"
      checked={checked}
      onChange={handleChange}
      aria-label={column.name}
    />
  );
}
