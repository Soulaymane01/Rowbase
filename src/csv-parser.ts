import * as Papa from "papaparse";
import { ColumnDef, DatabaseModel, ViewDef } from "./types";

export const FORMAT_VERSION = 1;

const DEFAULT_VIEW: ViewDef = { name: "Default", sorts: [], filters: [], hiddenColumns: [] };

export function splitMultiSelect(cell: string): string[] {
  if (!cell) return [];
  const values: string[] = [];
  let current = "";
  for (let i = 0; i < cell.length; i++) {
    if (cell[i] === "\\" && i + 1 < cell.length) {
      current += cell[i + 1];
      i++;
    } else if (cell[i] === "|") {
      if (current) values.push(current);
      current = "";
    } else {
      current += cell[i];
    }
  }
  if (current) values.push(current);
  return values;
}

export function joinMultiSelect(values: string[]): string {
  return values
    .map((v) => v.replace(/\\/g, "\\\\").replace(/\|/g, "\\|"))
    .join("|");
}

export function parseCSV(csvText: string): DatabaseModel {
  const result = Papa.parse(csvText.trim(), {
    header: false,
    skipEmptyLines: true,
  });

  const rawRows = result.data as string[][];
  if (rawRows.length === 0) {
    return { columns: [], rows: [], views: [{ ...DEFAULT_VIEW }], formatVersion: FORMAT_VERSION };
  }

  const headerRow = rawRows[0];
  let views: ViewDef[] | null = null;
  let formatVersion: number | null = null;

  const columns: ColumnDef[] = headerRow.map((cell, i) => {
    try {
      const def = JSON.parse(cell) as ColumnDef & { views?: ViewDef[]; formatVersion?: number };
      if (!def.name) def.name = "Untitled";
      if (!def.type) def.type = "text";
      if (def.columnIndex == null) def.columnIndex = i;

      // Extract metadata from first column's header cell
      if (i === 0) {
        if (def.views) {
          views = def.views;
          delete def.views;
        }
        if (def.formatVersion != null) {
          formatVersion = def.formatVersion;
          delete def.formatVersion;
        }
      }

      return def;
    } catch {
      return { name: cell || "Untitled", type: "text" as const, columnIndex: i };
    }
  });

  const rows = rawRows.slice(1).map((row) => {
    // Pad or trim row to match column count
    while (row.length < columns.length) {
      row.push("");
    }
    return row.slice(0, columns.length);
  });

  return {
    columns,
    rows,
    views: views ?? [{ ...DEFAULT_VIEW }],
    formatVersion: formatVersion ?? 1,
  };
}

export function serializeCSV(model: DatabaseModel): string {
  const headerRow = model.columns.map((col, i) => {
    if (i === 0) {
      // Merge metadata into first column's header cell
      return JSON.stringify({ ...col, views: model.views, formatVersion: model.formatVersion });
    }
    return JSON.stringify(col);
  });

  const allRows = [headerRow, ...model.rows];

  return Papa.unparse(allRows, {
    header: false,
    newline: "\n",
  }) + "\n";
}
