import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

// Forbidden runtime patterns. Rowbase's runtime code must never contain these,
// because the plugin's runtime behavior is required to be fully offline.
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

// Rowbase-authored runtime source. This is the authoritative check: any
// forbidden pattern here means the plugin's own code performs network or
// dynamic-code behavior, which must be removed.
const SRC_DIR = "src";
// The production bundle produced by `npm run build`. It is audited separately
// so that Rowbase-authored behavior cannot hide in the compiled artifact.
const BUNDLE = "main.js";

// ---------------------------------------------------------------------------
// Inert artifacts from PRESERVED bundled dependencies (react, react-dom,
// papaparse). These are string literals or dead library code paths that are
// NOT runtime network behavior performed by Rowbase, and they cannot be
// removed without stripping bundled dependencies (which the task forbids).
// Each is documented so a reviewer can verify it against the bundle.
// ---------------------------------------------------------------------------

// URLs embedded by bundled dependencies as inert string constants. They are
// never fetched at runtime:
//   http://www.w3.org/...  — XML/SVG/MathML namespace identifiers used by
//                          React DOM for createElementNS (not network).
//   https://react.dev/errors/  — React dev-mode error help URL (never fetched).
//   https://github.com/mholt/PapaParse  — papaparse attribution URL.
const allowedBundleUrls = new Set([
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/XML/1998/namespace",
  "https://react.dev/errors/",
  "https://github.com/mholt/PapaParse",
]);

// papaparse's remote-download implementation uses `new XMLHttpRequest` inside
// its streaming read path (_readChunk). Rowbase never enables that download
// config (it only calls Papa.parse(string) and Papa.unparse(...)), so this is
// dead code carried inside the preserved dependency. It is the only allowed
// XMLHttpRequest and is uniquely identifiable by papaparse's specific context:
// the `_chunkLoaded` streaming callback combined with the `downloadConfig`
// marker (`withCredentials`). A genuine network XHR (e.g.
// `x.withCredentials = true; x.open(...); x.send();`) never uses `_chunkLoaded`,
// so requiring that identifier is what keeps a real request from slipping
// through the allowance.
const allowedXhrDownloadMarker = "withCredentials";
const allowedXhrPapaparseContext = "_chunkLoaded";

// The scan targets Rowbase runtime source (src/) and the production bundle
// (main.js) only, so documentation/metadata files (UPSTREAM.md, README.md,
// package-lock.json) are never scanned — mirroring the ignore rule.

// Strip JS/TS comments (// and /* */) while respecting string literals and
// template literals, so that comments which merely document the audit do not
// trigger false matches (and so the "//" inside "https://" is never eaten).
function stripComments(text) {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        out += text[i];
        if (text[i] === "\\") {
          out += text[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (text[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

// Audit `text` against the forbidden patterns. `stripInertUrls` removes the
// documented inert bundled-dependency URL constants from a working copy first
// (robust against minification's concatenation); `allowXhr` permits only the
// papaparse remote-download path, identified by BOTH its `downloadConfig`
// marker (`withCredentials`) AND its papaparse-specific streaming callback
// (`_chunkLoaded`) in the same window — so a genuine network XHR, which uses
// `withCredentials` but never `_chunkLoaded`, cannot satisfy the allowance.
function audit(text, { stripInertUrls = false, allowXhr = false, label = "" }) {
  let working = text;
  if (stripInertUrls) {
    for (const url of allowedBundleUrls) {
      working = working.split(url).join("");
    }
  }

  const violations = [];
  for (const re of forbidden) {
    const global = new RegExp(re.source, "g");
    let match;
    while ((match = global.exec(working)) !== null) {
      if (re.source === "XMLHttpRequest" && allowXhr) {
        const fragment = working.slice(match.index, match.index + 300);
        if (
          fragment.includes(allowedXhrDownloadMarker) &&
          fragment.includes(allowedXhrPapaparseContext)
        ) {
          continue;
        }
      }
      violations.push({ label, pattern: re.source, index: match.index });
    }
  }
  return violations;
}

// --- Source audit -----------------------------------------------------------
const sourceViolations = [];
for await (const file of walk(SRC_DIR)) {
  // icon-data.ts contains a base64-encoded PNG data URI — not network behavior.
  if (file.endsWith("icon-data.ts")) continue;
  const raw = await readFile(file, "utf8");
  const code = stripComments(raw);
  sourceViolations.push(...audit(code, { label: relative(".", file) }));
}

assert.equal(
  sourceViolations.length,
  0,
  `[offline] runtime source contains forbidden network/dynamic-code behavior:\n` +
    sourceViolations
      .map((v) => `  ${v.label} :: ${v.pattern}`)
      .join("\n")
);

// --- Bundle audit -----------------------------------------------------------
let bundleSource;
try {
  bundleSource = await readFile(BUNDLE, "utf8");
} catch {
  throw new Error(
    `[offline] ${BUNDLE} is missing — run \`npm run build\` before this audit.`
  );
}

const bundleViolations = audit(bundleSource, {
  stripInertUrls: true,
  allowXhr: true,
  label: BUNDLE,
});

assert.equal(
  bundleViolations.length,
  0,
  `[offline] production bundle contains forbidden network/dynamic-code behavior:\n` +
    bundleViolations
      .map((v) => `  ${v.label} :: ${v.pattern}`)
      .join("\n")
);

console.log("offline baseline: PASS — no runtime network behavior found");

// --- Tighten-rule self-test --------------------------------------------------
// Guard against regressions: the papaparse XHR allowance must be scoped to
// papaparse's specific context and must NEVER let a genuine network XHR pass.
// (Exercise the bundle's papaparse shape plus a synthetic genuine XHR.)
const papaXhrSnippet =
  "this._readChunk=function(){if(this._finished)this._chunkLoaded();else{" +
  "var f=new XMLHttpRequest;this._config.withCredentials&&(f.withCredentials=this._config.withCredentials);" +
  "f.onload=S(this._chunkLoaded,this);f.onerror=S(this._chunkError,this);" +
  'f.open(this._config.downloadRequestBody?"POST":"GET",this._input,true);}}';

// A genuine network XHR: uses `withCredentials` but never papaparse's callback.
const genuineXhrSnippet =
  'var x=new XMLHttpRequest;x.withCredentials=true;x.open("GET",url);x.send();';

// Detection is real: with the allowance OFF the papaparse XHR is flagged.
assert.notEqual(
  audit(papaXhrSnippet, { allowXhr: false }).length,
  0,
  "[offline] papaparse XHR must still be detected when the allowance is off"
);
// The scoped allowance permits ONLY the papaparse context...
assert.equal(
  audit(papaXhrSnippet, { allowXhr: true }).length,
  0,
  "[offline] papaparse inert XHR must remain allowed by the tightened rule"
);
// ...and a genuine network XHR is NOT allowed, even with the allowance on.
assert.notEqual(
  audit(genuineXhrSnippet, { allowXhr: true }).length,
  0,
  "[offline] a genuine network XHR (withCredentials + open + send) must NOT pass"
);
