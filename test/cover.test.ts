import assert from "node:assert/strict";
import { test } from "node:test";
import { isCoverColumnName, pickCoverColumn } from "../src/query/cover.ts";
import { ColumnDef } from "../src/types.ts";

test("cover column names are recognized", () => {
  for (const n of ["Cover", "cover", "Image", "Thumbnail", "thumb", "Photo", "Poster", "img", "IMG"]) {
    assert.equal(isCoverColumnName(n), true, n);
  }
  assert.equal(isCoverColumnName("Link"), false);
  assert.equal(isCoverColumnName("URL"), false);
  assert.equal(isCoverColumnName("Cover image"), false);
});

test("no candidate with cover values means no cover column", () => {
  const columns: ColumnDef[] = [
    { name: "URL", type: "url" },
    { name: "Link", type: "link" },
  ];
  assert.equal(pickCoverColumn(columns, () => false), null);
});

test("a plain URL column is only used when its values resolve to images", () => {
  const columns: ColumnDef[] = [{ name: "URL", type: "url" }];
  assert.equal(pickCoverColumn(columns, (_c, i) => i === 0), columns[0]);
  assert.equal(pickCoverColumn(columns, () => false), null);
});

test("an explicitly named cover column wins over an image column", () => {
  const columns: ColumnDef[] = [
    { name: "Cover", type: "text" },
    { name: "Image", type: "image" },
  ];
  const picked = pickCoverColumn(columns, (_c, i) => i === 0 || i === 1);
  assert.equal(picked?.name, "Cover");
});

test("an empty named cover column falls through to the image column", () => {
  const columns: ColumnDef[] = [
    { name: "Cover", type: "image" },
    { name: "Photo", type: "image" },
  ];
  const picked = pickCoverColumn(columns, (_c, i) => i === 1);
  assert.equal(picked?.name, "Photo");
});

test("image columns win over url/link columns", () => {
  const columns: ColumnDef[] = [
    { name: "URL", type: "url" },
    { name: "Image", type: "image" },
  ];
  const picked = pickCoverColumn(columns, () => true);
  assert.equal(picked?.name, "Image");
});

test("a link gallery without image values has no cover", () => {
  const columns: ColumnDef[] = [
    { name: "Title", type: "title" },
    { name: "URL", type: "url" },
    { name: "Notes", type: "text" },
  ];
  assert.equal(pickCoverColumn(columns, (_c, i) => i === 2), null);
});
