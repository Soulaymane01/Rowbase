import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCSV, serializeCSV } from "../src/csv-parser.ts";

test("parses and round-trips the upstream csvdb format", () => {
  // Header cells are CSV-quoted with doubled inner quotes, exactly as
  // Papa.unparse (serializeCSV) emits them. The first column's header cell
  // carries the metadata (views + formatVersion).
  const source = [
    '"{""name"":""Name"",""type"":""title"",""columnIndex"":0,""views"":[{""name"":""Default"",""sorts"":[],""filters"":[],""hiddenColumns"":[]}],""formatVersion"":1}","{""name"":""Status metadata"",""type"":""text"",""columnIndex"":1}"',
    '"Alpha","Done"',
    '"Beta, quoted","Todo"',
  ].join("\n") + "\n";

  const model = parseCSV(source);
  assert.equal(model.columns.length, 2);
  assert.equal(model.rows.length, 2);
  assert.equal(model.rows[1]?.[0], "Beta, quoted");

  const reparsed = parseCSV(serializeCSV(model));
  assert.deepEqual(reparsed, model);
});
