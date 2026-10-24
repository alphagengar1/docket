// Hand-rolled check of a live DecisionRecord against docs/schema/decision-record.schema.json.
// ajv is not a dependency, so this walks the schema subset we use: type, enum, const, required,
// additionalProperties, patternProperties, oneOf, items.
// Usage: DOCKET_API_URL=https://<deployment>.convex.site DOCKET_API_KEY=... node validate-record.mjs <applicantId>
import { readFileSync } from "node:fs";
const schema = JSON.parse(readFileSync(new URL("./decision-record.schema.json", import.meta.url)));
const typeOf = (x) => (x === null ? "null" : Array.isArray(x) ? "array" : Number.isInteger(x) ? "integer" : typeof x);
const isType = (x, t) => (t === "number" ? typeof x === "number" : typeOf(x) === t);

function check(v, s, path, errs) {
  if (s.oneOf) {
    const ok = s.oneOf.some((alt) => { const e = []; check(v, alt, path, e); return e.length === 0; });
    if (!ok) errs.push(`${path}: matches no oneOf branch`);
    return;
  }
  if ("const" in s && v !== s.const) errs.push(`${path}: expected ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.includes(v)) errs.push(`${path}: ${JSON.stringify(v)} not in enum`);
  if (s.type) {
    const ts = [].concat(s.type);
    if (!ts.some((t) => isType(v, t))) { errs.push(`${path}: expected ${ts.join("|")}, got ${typeOf(v)}`); return; }
  }
  if (s.minimum !== undefined && typeof v === "number" && v < s.minimum) errs.push(`${path}: below minimum`);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const k of s.required ?? []) if (!(k in v)) errs.push(`${path}.${k}: required`);
    const props = s.properties ?? {};
    const pats = Object.keys(s.patternProperties ?? {}).map((p) => [new RegExp(p), s.patternProperties[p]]);
    for (const [k, val] of Object.entries(v)) {
      if (props[k]) check(val, props[k], `${path}.${k}`, errs);
      else {
        const hit = pats.find(([re]) => re.test(k));
        if (hit) check(val, hit[1], `${path}.${k}`, errs);
        else if (s.additionalProperties === false) errs.push(`${path}.${k}: unexpected property`);
      }
    }
  }
  if (Array.isArray(v) && s.items) v.forEach((x, i) => check(x, s.items, `${path}[${i}]`, errs));
}

const id = process.argv[2];
const res = await fetch(`${process.env.DOCKET_API_URL}/api/v1/decisions/${id}`, { headers: { authorization: `Bearer ${process.env.DOCKET_API_KEY}` } });
const rec = await res.json();
const errs = [];
check(rec, schema, "$", errs);
console.log(errs.length ? errs.join("\n") : `OK: record for ${id} satisfies the schema (${rec.lenders.length} lenders)`);
process.exit(errs.length ? 1 : 0);
