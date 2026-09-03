import { ColumnType, FilterOperator } from "../types";

export const TEXT_OPERATORS: FilterOperator[] = [
  "equals", "is-not", "contains", "does-not-contain", "starts-with", "is-empty", "is-not-empty",
];
export const NUMBER_OPERATORS: FilterOperator[] = [
  "equals", "is-not", "greater-than", "less-than", "between", "is-empty", "is-not-empty",
];
export const DATE_OPERATORS: FilterOperator[] = [
  "equals", "is-not", "before", "after", "between", "is-empty", "is-not-empty",
];
export const MULTI_OPERATORS: FilterOperator[] = [
  "contains", "does-not-contain", "is-empty", "is-not-empty",
];

export function operatorsForType(type: ColumnType): FilterOperator[] {
  if (type === "number") return NUMBER_OPERATORS;
  if (type === "date") return DATE_OPERATORS;
  if (type === "multiselect" || type === "relation") return MULTI_OPERATORS;
  return TEXT_OPERATORS;
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  "equals": "Equals",
  "is-not": "Is not",
  "contains": "Contains",
  "does-not-contain": "Does not contain",
  "starts-with": "Starts with",
  "is-empty": "Is empty",
  "is-not-empty": "Is not empty",
  "greater-than": "Greater than",
  "less-than": "Less than",
  "between": "Between",
  "before": "Before",
  "after": "After",
};
