import { ColumnDef, FilterOperator } from "../types";
import { TypedValue } from "./resolve";

export function matchesFilter(
  value: TypedValue,
  column: ColumnDef,
  operator: FilterOperator,
  filterValues: string[],
): boolean {
  const vals = filterValues.filter((v) => v !== "");
  if (operator === "is-empty") return value.kind === "empty";
  if (operator === "is-not-empty") return value.kind !== "empty";
  // Fail closed: empty value must explicitly be targeted by is-empty.
  if (value.kind === "empty") return false;

  switch (operator) {
    case "equals": {
      if (value.kind === "number") return vals.length > 0 && value.number === Number(vals[0]);
      if (value.kind === "date") return vals.length > 0 && sameDate(value.date, vals[0]);
      if (value.kind === "multi") return vals.length > 0 && value.multi.map(normalize).join("|") === vals.map(normalize).join("|");
      return value.kind === "text" && vals.map(normalize).includes(normalize(value.text));
    }
    case "is-not":
      return !matchesFilter(value, column, "equals", filterValues);
    case "contains": {
      if (value.kind === "multi") return value.multi.some((m) => vals.map(normalize).includes(normalize(m)));
      const text = value.kind === "text" ? value.text : String(value.kind === "number" ? value.number : value.kind === "date" ? value.date.toISOString() : "");
      return vals.some((v) => normalize(text).includes(normalize(v)));
    }
    case "does-not-contain":
      return !matchesFilter(value, column, "contains", filterValues);
    case "starts-with": {
      const text = value.kind === "text" ? value.text : String(value.kind === "number" ? value.number : "");
      return vals.some((v) => normalize(text).startsWith(normalize(v)));
    }
    case "greater-than": {
      if (value.kind === "number") {
        const n = Number(vals[0]);
        if (Number.isNaN(n)) return false;
        return value.number > n;
      }
      if (value.kind === "date") {
        if (vals.length === 0) return false;
        const t = new Date(vals[0]).getTime();
        if (Number.isNaN(t)) return false;
        return value.date.getTime() > t;
      }
      return false;
    }
    case "less-than": {
      if (value.kind === "number") {
        const n = Number(vals[0]);
        if (Number.isNaN(n)) return false;
        return value.number < n;
      }
      if (value.kind === "date") {
        if (vals.length === 0) return false;
        const t = new Date(vals[0]).getTime();
        if (Number.isNaN(t)) return false;
        return value.date.getTime() < t;
      }
      return false;
    }
    case "between": {
      if (value.kind === "number") {
        const lo = Number(vals[0]);
        const hi = Number(vals[1]);
        if (Number.isNaN(lo) || Number.isNaN(hi)) return false;
        return value.number >= lo && value.number <= hi;
      }
      if (value.kind === "date") {
        if (vals.length < 2) return false;
        const t = value.date.getTime();
        const lo = new Date(vals[0]).getTime();
        const hi = new Date(vals[1]).getTime();
        if (Number.isNaN(lo) || Number.isNaN(hi)) return false;
        return t >= lo && t <= hi;
      }
      return false;
    }
    case "before": {
      if (value.kind !== "date") return false;
      return value.date.getTime() < new Date(vals[0]).getTime();
    }
    case "after": {
      if (value.kind !== "date") return false;
      return value.date.getTime() > new Date(vals[0]).getTime();
    }
    default:
      return false;
  }
}

function normalize(s: string): string {
  return s === undefined || s === null ? "" : s.trim().toLowerCase();
}

function sameDate(d: Date, iso: string): boolean {
  const o = new Date(iso);
  return d.getFullYear() === o.getFullYear() && d.getMonth() === o.getMonth() && d.getDate() === o.getDate();
}
