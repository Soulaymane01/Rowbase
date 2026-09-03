# Rowbase Baseline Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone Rowbase plugin repository from `jysperm/obsidian-csv-database`, rebrand it safely, preserve `.csvdb` compatibility, remove non-offline behavior, and verify the baseline build.

**Architecture:** Rowbase starts as a source fork, not a dependency or wrapper. The existing CSV parser, typed schema model, dedicated Obsidian file view, saved views, inline editing, and relation code remain the baseline. This phase makes only identity, repository, offline-policy, and verification changes; feature work begins afterward behind the existing model.

**Tech Stack:** TypeScript, React 19, React DOM, PapaParse, esbuild, Obsidian API, Node.js test scripts.

## Global Constraints

- Every database uses exactly one `.csvdb` file.
- Databases open in a dedicated Obsidian view, never as SQL code blocks in notes.
- Runtime behavior is fully offline. No HTTP requests, WebSockets, telemetry, CDN assets, or remote service calls are allowed.
- The initial release is desktop-first and remains `isDesktopOnly: true` until a deliberate mobile pass is complete.
- Database files remain human-readable and compatible with the selected base's storage contract.
- Rowbase will not depend on the upstream package at build time or runtime.
- The source and built bundle will be audited for fetch, XHR, WebSocket, remote asset, telemetry, dynamic-code, and secret-access patterns.

---

### Task 1: Import And Record The Upstream Fork

**Files:**
- Create: repository contents copied from `jysperm/obsidian-csv-database` at the approved starting commit.
- Create: `UPSTREAM.md`
- Create: `.gitignore` additions for build output and local Obsidian deployment folders.
- Test: Git history and clean working tree.

**Interfaces:**
- Produces a standalone repository at `/home/soulaymane/dev/rowbase`.
- Records the upstream source and starting commit without making Rowbase depend on it.

- [ ] **Step 1: Add the upstream remote and copy the source**

Run from `/home/soulaymane/dev/rowbase`:

```bash
git remote add upstream https://github.com/jysperm/obsidian-csv-database.git
git fetch --depth 1 upstream
git archive FETCH_HEAD | tar -x
```

Preserve the already committed `docs/superpowers/` directory while extracting
the upstream files. Do not copy the upstream `.git` directory.

- [ ] **Step 2: Record the exact source commit**

Run:

```bash
git rev-parse FETCH_HEAD
```

Create `UPSTREAM.md` with the upstream URL, the returned commit hash, the
baseline inherited areas (`src/csv-parser.ts`, `src/types.ts`,
`src/relation-utils.ts`, `src/database-view.ts`, and the React components), and
the rule that Rowbase is maintained independently.

- [ ] **Step 3: Verify the repository contains both design history and source**

Run:

```bash
git status --short
git log --oneline --all --max-count=5
```

Expected: the design commit and imported source are present, with no nested
`.git` directory and no unrelated vault files.

- [ ] **Step 4: Commit the imported baseline**

Run:

```bash
git add -A
git diff --cached --check
git commit -m "chore: import CSV Database baseline"
```

### Task 2: Rebrand The Plugin Identity

**Files:**
- Modify: `package.json`
- Modify: `manifest.json`
- Modify: `src/main.ts`
- Modify: `README.md`
- Modify: `LICENSE`
- Test: `manifest.json` and package metadata inspection.

**Interfaces:**
- Produces plugin ID `rowbase`, display name `Rowbase`, and an Obsidian entry
  point that registers the existing `.csvdb` view.
- Keeps the `.csvdb` extension and existing view type behavior unchanged.

- [ ] **Step 1: Write the metadata assertions**

Add a Node test file `test-baseline-metadata.mjs` that reads `manifest.json`
and `package.json` and asserts:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));

assert.equal(manifest.id, "rowbase");
assert.equal(manifest.name, "Rowbase");
assert.equal(manifest.isDesktopOnly, true);
assert.equal(pkg.name, "rowbase");
assert.equal(pkg.main, "main.js");
```

- [ ] **Step 2: Run the metadata test and verify it fails**

Run:

```bash
node test-baseline-metadata.mjs
```

Expected: FAIL because the copied project still identifies itself as CSV
Database.

- [ ] **Step 3: Apply the minimal identity changes**

Change package and manifest identity to Rowbase, keep `main.js` as the output,
keep `isDesktopOnly: true`, and update user-facing README text to describe the
Rowbase fork and `.csvdb` storage. Preserve the MIT license notice and add the
upstream attribution documented in `UPSTREAM.md`.

Do not rename `VIEW_TYPE_CSV_DATABASE` or the `.csvdb` extension in this task;
those are compatibility-sensitive implementation details for the next phase.

- [ ] **Step 4: Make the metadata test pass**

Run:

```bash
node test-baseline-metadata.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the rebrand**

Run:

```bash
git add package.json manifest.json src/main.ts README.md LICENSE test-baseline-metadata.mjs
git diff --cached --check
git commit -m "chore: rebrand plugin as Rowbase"
```

### Task 3: Enforce The Offline Baseline

**Files:**
- Modify: `package.json`
- Modify: `src/**/*.ts` only if an inherited runtime network call is found.
- Modify: `README.md`
- Create: `test-offline-baseline.mjs`
- Test: source and bundle audit.

**Interfaces:**
- Produces a plugin whose runtime code has no network-capable behavior.
- Removes optional integrations that contact localhost or external services.

- [ ] **Step 1: Write the offline audit test**

Create `test-offline-baseline.mjs` that recursively reads source files and the
production `main.js`, then rejects these patterns:

```js
const forbidden = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /https?:\/\//,
  /127\.0\.0\.1/,
  /localhost/,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
];
```

The test must ignore `UPSTREAM.md`, README installation links, package lock
metadata, and comments that document the audit itself. It must inspect runtime
source and the final bundle, not only dependencies.

- [ ] **Step 2: Run the audit and identify inherited violations**

Run:

```bash
npm run build
node test-offline-baseline.mjs
```

Expected: the audit fails if the inherited source contains a network-capable
feature. Record each match before changing code.

- [ ] **Step 3: Remove only runtime network behavior**

If the audit finds an optional integration such as AnkiConnect, remove its
runtime command, UI entry point, and related imports. Do not remove local CSV
editing, relation loading, Obsidian vault access, or bundled dependencies.

Do not silence the audit by deleting the test or by excluding a runtime file.

- [ ] **Step 4: Make the audit pass**

Run:

```bash
npm run build
node test-offline-baseline.mjs
```

Expected: PASS with no runtime network matches.

- [ ] **Step 5: Commit the offline baseline**

Run:

```bash
git add package.json src README.md test-offline-baseline.mjs main.js
git diff --cached --check
git commit -m "security: enforce offline runtime baseline"
```

### Task 4: Establish Baseline Build And Parser Tests

**Files:**
- Modify: `package.json`
- Create: `test/csv-parser.test.ts`
- Modify: `src/csv-parser.ts` only if tests expose a compatibility defect.
- Test: parser, typecheck, production build, and lint.

**Interfaces:**
- Produces repeatable local checks for `.csvdb` round trips before feature work.
- Preserves `parseCSV(text): DatabaseModel` and
  `serializeCSV(model): string` as the storage boundary.

- [ ] **Step 1: Write round-trip tests against the existing format**

Install `tsx` as a development-only dependency, then create
`test/csv-parser.test.ts` covering:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCSV, serializeCSV } from "../src/csv-parser.ts";

test("parses and round-trips the upstream csvdb format", () => {
  const source = [
    '{"name":"Name","type":"title","views":[{"name":"Default","sorts":[],"filters":[],"hiddenColumns":[]}],"formatVersion":1},"Status metadata"',
    '"Alpha","Done"',
    '"Beta, quoted","Todo"',
  ].join("\\n") + "\\n";

  const model = parseCSV(source);
  assert.equal(model.columns.length, 2);
  assert.equal(model.rows.length, 2);
  assert.equal(model.rows[1]?.[0], "Beta, quoted");

  const reparsed = parseCSV(serializeCSV(model));
  assert.deepEqual(reparsed, model);
});
```

`tsx` is test tooling only and must not be imported from runtime source.

- [ ] **Step 2: Run the parser test and verify the baseline result**

Run:

```bash
tsx --test test/csv-parser.test.ts
```

Expected: PASS against the copied upstream parser. If it fails, isolate the
compatibility defect before rebranding further.

- [ ] **Step 3: Add the baseline check script**

Add these scripts to `package.json` without changing the production bundle
entry point:

```json
{
  "scripts": {
    "test:metadata": "node test-baseline-metadata.mjs",
    "test:offline": "node test-offline-baseline.mjs",
    "typecheck": "tsc --noEmit",
    "test:csvdb": "tsx --test test/csv-parser.test.ts",
    "check:baseline": "npm run typecheck && npm run test:metadata && npm run test:csvdb && npm run build && npm run test:offline"
  }
}
```

Keep the existing `build`, `dev`, and `start` scripts unchanged. The new
`typecheck`, `test:metadata`, `test:offline`, `test:csvdb`, and
`check:baseline` scripts must be present exactly as named above.

- [ ] **Step 4: Run all baseline checks**

Run:

```bash
npm run check:baseline
```

Expected: typecheck, metadata test, CSV round-trip test, production build, and
offline audit all pass.

- [ ] **Step 5: Run lint and record non-blocking inherited findings**

Run:

```bash
npm run lint
```

Fix errors introduced by Rowbase changes. Record pre-existing upstream lint
errors separately rather than broadening this baseline task into a refactor.

- [ ] **Step 6: Commit the verification harness**

Run:

```bash
git add package.json package-lock.json test-baseline-metadata.mjs test-offline-baseline.mjs test/csv-parser.test.ts
git diff --cached --check
git commit -m "test: add Rowbase baseline verification"
```

### Task 5: Verify Installation In An Isolated Obsidian Vault

**Files:**
- Create: `$HOME/rowbase-dev-vault`, separate from the production Haven vault.
- Create: `.obsidian/plugins/rowbase/` deployment link or copied build artifacts.
- Test: plugin loading, database creation/opening, inline edit persistence, and
  relation picker visibility.

**Interfaces:**
- Produces manual confirmation that the baseline plugin loads in Obsidian and
  still opens and saves a `.csvdb` file.

- [ ] **Step 1: Prepare the isolated vault**

Create `$HOME/rowbase-dev-vault` and enable community plugins without modifying
the production Haven vault. Link only the built Rowbase artifacts:

```bash
mkdir -p "$HOME/rowbase-dev-vault/.obsidian/plugins"
ln -s /home/soulaymane/dev/rowbase "$HOME/rowbase-dev-vault/.obsidian/plugins/rowbase"
```

Do not place the symlink in `/home/soulaymane/Main/Haven`.

- [ ] **Step 2: Load Rowbase in Obsidian**

Enable the `rowbase` plugin and confirm there are no startup errors in the
developer console. Confirm the plugin appears under the Rowbase name, not CSV
Database.

- [ ] **Step 3: Verify the storage contract manually**

Create or open a `.csvdb` file, add a row, edit a cell, reload the file, and
confirm the edited value remains in the same single file. Confirm no record
notes are created automatically.

- [ ] **Step 4: Verify the existing relation behavior manually**

Create two `.csvdb` files, configure a relation column, select a target row,
reload both files, and confirm the relation remains present.

- [ ] **Step 5: Commit baseline verification notes**

Create `docs/superpowers/verification/2026-09-03-rowbase-baseline.md` with the
Obsidian version, vault test steps, result of each check, and any concrete
follow-up defect. Commit it:

```bash
git add docs/superpowers/verification/2026-09-03-rowbase-baseline.md
git diff --cached --check
git commit -m "test: verify Rowbase baseline in Obsidian"
```

## Plan Completion Gate

The baseline phase is complete only when:

- Rowbase source exists as a standalone repository at `/home/soulaymane/dev/rowbase`.
- Upstream provenance and MIT attribution are recorded.
- Manifest identity is `rowbase` and `isDesktopOnly` is `true`.
- `.csvdb` parsing, serialization, dedicated view registration, and relations remain functional.
- Typecheck and production build pass.
- Metadata, CSV round-trip, and offline audits pass.
- Obsidian loads the plugin in an isolated development vault.
- Verification notes are committed.

The next implementation plan should begin only after this gate and should target
the shared query model plus rich filters as a separate, independently verified
phase.
