import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TEMPLATE_COLUMNS, isLegacyDefaultTemplate } from "../src/constants.ts";

test("the built-in template starts with a Title column", () => {
  const columns = JSON.parse(DEFAULT_TEMPLATE_COLUMNS) as { name: string; type: string }[];
  assert.equal(columns[0].name, "Name");
  assert.equal(columns[0].type, "title");
});

test("the untouched 0.1.3 template is detected as legacy", () => {
  const legacy013 = JSON.stringify([
    { name: "Name", type: "text" },
    {
      name: "Status",
      type: "select",
      options: [
        { value: "Todo", color: "red" },
        { value: "In Progress", color: "yellow" },
        { value: "Done", color: "green" },
      ],
    },
    { name: "Date", type: "date" },
  ]);
  assert.equal(isLegacyDefaultTemplate(legacy013), true);
});

test("the current template and custom templates are not migrated", () => {
  assert.equal(isLegacyDefaultTemplate(DEFAULT_TEMPLATE_COLUMNS), false);
  assert.equal(isLegacyDefaultTemplate(JSON.stringify([{ name: "Title", type: "text" }])), false);
  assert.equal(isLegacyDefaultTemplate("not json"), false);
  assert.equal(isLegacyDefaultTemplate("[]"), false);
});
