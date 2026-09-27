import { ColumnDef } from "../types";

export const MATRIX_IMPORTANT_HINTS = ["high", "important", "critical", "urgent", "yes", "true", "1", "p1"];
export const MATRIX_URGENT_HINTS = ["high", "urgent", "critical", "asap", "soon", "yes", "true", "1", "p1"];
export const MATRIX_URGENT_WINDOW_DAYS = 7;

/** Union of both axes' hint words, used to guess a select column's "high" option. */
const MATRIX_HIGH_HINTS = Array.from(new Set([...MATRIX_IMPORTANT_HINTS, ...MATRIX_URGENT_HINTS]));

export type MatrixQuadrantKey = "q1" | "q2" | "q3" | "q4";

function matchesHint(value: string, hints: string[], highValue?: string): boolean {
  if (!value) return false;
  if (highValue) return value === highValue;
  return hints.includes(value.trim().toLowerCase());
}

/** Is a cell value "important" for the matrix's importance axis? */
export function isMatrixImportant(value: string, col: ColumnDef | undefined, highValue?: string): boolean {
  if (!value || !col) return false;
  if (col.type === "checkbox") return value === "true";
  if (col.type === "select") return matchesHint(value, MATRIX_IMPORTANT_HINTS, highValue);
  return false;
}

/** Is a cell value "urgent" for the matrix's urgency axis? Date columns count as urgent when overdue or due within a week. */
export function isMatrixUrgent(
  value: string,
  col: ColumnDef | undefined,
  highValue?: string,
  now: number = Date.now()
): boolean {
  if (!value || !col) return false;
  if (col.type === "date") {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return false;
    return time - now <= MATRIX_URGENT_WINDOW_DAYS * 86_400_000;
  }
  if (col.type === "checkbox") return value === "true";
  if (col.type === "select") return matchesHint(value, MATRIX_URGENT_HINTS, highValue);
  return false;
}

/** Q1 Do first · Q2 Schedule · Q3 Delegate · Q4 Eliminate */
export function getMatrixQuadrant(important: boolean, urgent: boolean): MatrixQuadrantKey {
  if (important && urgent) return "q1";
  if (important) return "q2";
  if (urgent) return "q3";
  return "q4";
}

/**
 * Cell value to write when a card is dragged onto an axis with the given
 * high/low state. Returns null when the column type can't express the axis
 * (date columns on the urgency axis are read-only for dragging).
 */
export function getMatrixAxisValue(
  col: ColumnDef | undefined,
  high: boolean,
  highValue?: string
): string | null {
  if (!col) return null;
  if (col.type === "checkbox") return high ? "true" : "false";
  if (col.type !== "select") return null;

  const options = col.options ?? [];
  const highResolved =
    highValue ||
    options.find((o) => MATRIX_HIGH_HINTS.includes(o.value.trim().toLowerCase()))?.value ||
    options[0]?.value;

  if (high) return highResolved ?? null;
  const low = options.find((o) => o.value !== highResolved);
  return low ? low.value : "";
}
