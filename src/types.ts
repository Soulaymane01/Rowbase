export type ColumnType = "text" | "number" | "date" | "checkbox" | "select" | "multiselect" | "note" | "title" | "relation" | "url" | "link" | "formula" | "rollup";

export type TagColor = "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red";

export interface SelectOption {
  value: string;
  color?: TagColor;
}

export interface ColumnDef {
  name: string;
  type: ColumnType;
  options?: SelectOption[];
  titleNoteEnabled?: boolean;
  titleNoteFolder?: string;
  relationTargetPath?: string;
  relationMultiple?: boolean;
  width?: number;
  columnIndex?: number;
  wrapContent?: boolean;
  formula?: string;
  rollup?: { relationColumn: string; targetColumn: string; handler: "count" | "sum" | "avg" | "min" | "max" | "list"; targetFilter?: { column: string; equals: string } };
}

export interface DisplayColumn {
  col: ColumnDef;
  dataIdx: number;
}

export interface SortRule {
  column: string;
  direction: "asc" | "desc";
}

export type FilterOperator =
  | "equals" | "is-not"
  | "contains" | "does-not-contain" | "starts-with"
  | "is-empty" | "is-not-empty"
  | "greater-than" | "less-than" | "between"
  | "before" | "after";

export interface FilterRule {
  column: string;
  operator: FilterOperator;
  value: string[];
}

export type ViewLayout = "table" | "kanban" | "list" | "gallery" | "chart";

export interface ViewDef {
  name: string;
  layout?: ViewLayout;
  sorts: SortRule[];
  filters: FilterRule[];
  hiddenColumns: string[];
  groupByColumn?: string;
  chartType?: "bar" | "line" | "pie" | "area";
  chartXColumn?: string;
  chartYColumn?: string;
  chartAgg?: "count" | "sum" | "avg";
  chartColorByColumn?: string;
}

export interface DatabaseModel {
  columns: ColumnDef[];
  rows: string[][];
  views: ViewDef[];
  formatVersion: number;
}
