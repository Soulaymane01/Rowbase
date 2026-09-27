import { ColumnDef } from "../types";

export const MATRIX_IMPORTANT_HINTS = ["high", "important", "critical", "urgent", "yes", "true", "1", "p1"];
export const MATRIX_URGENT_HINTS = ["high", "urgent", "critical", "asap", "soon", "yes", "true", "1", "p1"];
export const MATRIX_URGENT_WINDOW_DAYS = 7;

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
