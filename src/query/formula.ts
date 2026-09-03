export type FormulaValue = number | string | boolean | null;

export interface FormulaEnv {
  getColumn(name: string): FormulaValue;
  getRelatedNumbers(relationColumn: string, valueColumn: string): number[];
}

export type FormulaCell =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "error"; message: string };

type Tok = { kind: "num"; v: number } | { kind: "str"; v: string } | { kind: "id"; v: string }
  | { kind: "op"; v: string } | { kind: "lparen" } | { kind: "rparen" } | { kind: "comma" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = src.slice(i).match(/^\d*\.?\d+/);
      if (!m) throw new Error("bad number");
      out.push({ kind: "num", v: parseFloat(m[0]) });
      i += m[0].length; continue;
    }
    if (c === '"') {
      let j = i + 1; let s = "";
      while (j < src.length && src[j] !== '"') { s += src[j]; j++; }
      if (j >= src.length) throw new Error("unterminated string");
      out.push({ kind: "str", v: s });
      i = j + 1; continue;
    }
    if (/[A-Za-z_/.$\u00a0-\uffff]/.test(c)) {
      const m = src.slice(i).match(/[A-Za-z_][A-Za-z0-9_/.$.]*/);
      if (!m) throw new Error("bad identifier");
      out.push({ kind: "id", v: m[0] });
      i += m[0].length; continue;
    }
    if ("+-*/<>!=&".includes(c)) {
      if ((c === "<" || c === ">" || c === "!") && src[i + 1] === "=") {
        out.push({ kind: "op", v: c + "=" });
        i += 2; continue;
      }
      out.push({ kind: "op", v: c });
      i++; continue;
    }
    if (c === "(") { out.push({ kind: "lparen" }); i++; continue; }
    if (c === ")") { out.push({ kind: "rparen" }); i++; continue; }
    if (c === ",") { out.push({ kind: "comma" }); i++; continue; }
    throw new Error(`unexpected character "${c}"`);
  }
  return out;
}

function toNumber(v: FormulaValue): number {
  if (v === null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

export function evaluateFormula(expr: string, env: FormulaEnv): FormulaCell {
  try {
    const tokens = tokenize(expr);
    let pos = 0;
    const peek = () => tokens[pos] ?? null;
    const next = () => tokens[pos++];

    function parseExpr(): number | string | boolean {
      let left = parseOr();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && (t.v === "&")) {
          next();
          const right = parseOr();
          left = String(left as any) + String(right as any);
        } else break;
      }
      return left as any;
    }

    function parseOr(): any {
      let left = parseAnd();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && t.v === "||") { next(); const right = parseAnd(); left = truthy(left) || truthy(right); }
        else break;
      }
      return left;
    }

    function parseAnd(): any {
      let left = parseCmp();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && t.v === "&&") { next(); const right = parseCmp(); left = truthy(left) && truthy(right); }
        else break;
      }
      return left;
    }

    function parseCmp(): any {
      let left = parseAdd();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && ["=", "!=", "<", ">", "<=", ">="].includes(t.v)) {
          next();
          const right = parseAdd();
          const lt = left as any, rt = right as any;
          left = t.v === "=" ? lt === rt
            : t.v === "!=" ? lt !== rt
            : t.v === "<" ? lt < rt
            : t.v === ">" ? lt > rt
            : t.v === "<=" ? lt <= rt
            : lt >= rt;
        } else break;
      }
      return left;
    }

    function parseAdd(): any {
      let left = parseMul();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && (t.v === "+" || t.v === "-")) {
          next();
          const right = parseMul();
          const lt = left as any, rt = right as any;
          left = t.v === "+" ? lt + rt : lt - rt;
        } else break;
      }
      return left;
    }

    function parseMul(): any {
      let left = parseUnary();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && (t.v === "*" || t.v === "/")) {
          next();
          const right = parseUnary();
          const lt = left as any, rt = right as any;
          if (t.v === "/") {
            if (rt === 0) throw new Error("division by zero");
            left = lt / rt;
          } else left = lt * rt;
        } else break;
      }
      return left;
    }

    function parseUnary(): any {
      const t = peek();
      if (t?.kind === "op" && t.v === "-") { next(); const v = parseUnary(); return -toNumber(v as any); }
      if (t?.kind === "op" && t.v === "+") { next(); return parseUnary(); }
      return parsePostfix();
    }

    function parsePostfix(): any {
      let base = parseAtom();
      return base as any;
    }

    function truthy(v: any): boolean {
      if (v === null) return false;
      if (typeof v === "string") return v.length > 0;
      if (typeof v === "number") return v !== 0;
      return Boolean(v);
    }

    function resolveId(id: string): FormulaValue {
      // aggregate syntax relation.column → related numbers
      if (id.includes(".")) {
        const [rel, col] = id.split(".");
        return String(env.getRelatedNumbers(rel, col).join(","));
      }
      return env.getColumn(id);
    }

    function callAgg(name: string, id: string): number {
      const [rel, col] = id.includes(".") ? id.split(".") : ["", id];
      if (!col) throw new Error("aggregate needs a column");
      const nums = rel ? env.getRelatedNumbers(rel, col) : [toNumber(env.getColumn(col))];
      const valid = nums.filter((n) => !Number.isNaN(n));
      if (valid.length === 0) return 0;
      switch (name) {
        case "SUM": return valid.reduce((a, b) => a + b, 0);
        case "AVG": return valid.reduce((a, b) => a + b, 0) / valid.length;
        case "COUNT": return valid.length;
        case "MIN": return Math.min(...valid);
        case "MAX": return Math.max(...valid);
        default: throw new Error("unknown aggregate");
      }
    }

    function parseAtom(): any {
      const t = next();
      if (!t) throw new Error("unexpected end");
      if (t.kind === "num") return t.v;
      if (t.kind === "str") return t.v;
      if (t.kind === "id") {
        const name = t.v.toUpperCase();
        if (["SUM", "AVG", "COUNT", "MIN", "MAX"].includes(name)) {
          if (peek()?.kind !== "lparen") throw new Error(`${name} needs ( )`);
          next();
          const argTok = next();
          if (!argTok || argTok.kind !== "id") throw new Error("aggregate needs a column");
          const val = callAgg(name, argTok.v);
          if (peek()?.kind !== "rparen") throw new Error("aggregate missing )");
          next();
          return val;
        }
        if (name === "IF") {
          if (peek()?.kind !== "lparen") throw new Error("IF needs ( )");
          next();
          const cond = parseExpr();
          if (peek()?.kind !== "comma") throw new Error("IF needs comma");
          next();
          const thenV = parseExpr();
          if (peek()?.kind !== "comma") throw new Error("IF needs comma");
          next();
          const elseV = parseExpr();
          if (peek()?.kind !== "rparen") throw new Error("IF missing )");
          next();
          return truthy(cond) ? thenV : elseV;
        }
        return resolveId(t.v);
      }
      if (t.kind === "lparen") {
        const inner = parseExpr();
        if (peek()?.kind !== "rparen") throw new Error("missing )");
        next();
        return inner;
      }
      throw new Error("unexpected token");
    }

    const value = parseExpr();
    if (pos < tokens.length) throw new Error("trailing tokens");

    if (value === null) return { kind: "number", value: 0 };
    if (typeof value === "boolean") return { kind: "string", value: value ? "true" : "false" };
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return { kind: "error", message: "non-finite result" };
      return { kind: "number", value };
    }
    return { kind: "string", value: String(value) };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
