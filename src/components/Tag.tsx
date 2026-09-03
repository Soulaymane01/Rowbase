import { TAG_COLORS } from "../constants";
import { TagColor } from "../types";

interface TagProps {
  value: string;
  color: TagColor;
  onRemove?: (e: React.MouseEvent) => void;
}

export function Tag({ value, color, onRemove }: TagProps) {
  const colors = TAG_COLORS[color];
  return (
    <span
      className={`csv-db-tag ${onRemove ? "csv-db-tag-removable" : ""}`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {value}
      {onRemove && (
        <span
          className="csv-db-tag-remove-btn"
          onClick={onRemove}
        >
          ✕
        </span>
      )}
    </span>
  );
}
