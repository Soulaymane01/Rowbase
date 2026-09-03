import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTimelineItems } from "../src/query/timeline.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef } from "../src/types.ts";
const cols: ColumnDef[] = [{name:"Name",type:"text"},{name:"Start",type:"date"},{name:"End",type:"date"}];
function r(vals:string[], i:number){return resolveRow(buildRow(vals,i), cols);}
test("bar spans",()=>{const items=buildTimelineItems([r(["A","2024-01-01","2024-01-10"],0)],1,2,0); assert.equal(items[0].start.toISOString().slice(0,10),"2024-01-01");});
test("missing end treated as ongoing",()=>{const items=buildTimelineItems([r(["B","2024-01-01",""],0)],1,2,0); assert.equal(items.length,1);});
