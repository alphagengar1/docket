import { test } from "node:test";
import assert from "node:assert/strict";
import { buildComplianceInput, buildUnderwriterInput, fillName, scrubText, NAME_TOKEN } from "./pii.ts";
import { findPersona } from "./crs.mock.ts";
import { CRS_PERSONAS } from "./crs.personas.ts";
import { readFileSync } from "node:fs";
import { personaCodes, CARD_CODE_ALPHABET } from "./crs.personas.ts";
import { POLICIES } from "./policies.ts";

const FORBIDDEN_KEYS = /^(name|firstName|lastName|fullName|displayName|address|addresses|street|street1|addressLine1|city|zip|postalCode|ssn|dob|dateOfBirth|birthDate|phone|email|raw)$/i;
const SSN_DASHED = /\b\d{3}-\d{2}-\d{4}\b/;
const NINE = /\b\d{9}\b/;

function keysOf(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((i) => keysOf(i, out));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) (out.push(k), keysOf(v, out));
  return out;
}

const ids = Object.keys(CRS_PERSONAS);

test("underwriter input has no PII keys or SSN patterns for every persona", () => {
  assert.equal(ids.length, 20);
  for (const id of ids) {
    const p = findPersona(id)!;
    const crs = CRS_PERSONAS[id];
    // Hostile bundle: smuggle PII into extra keys and into free-text fields.
    const hostile: any = JSON.parse(JSON.stringify(p.bundle));
    hostile.raw = { ssn: crs.requests.tu.ssn };
    hostile.name = crs.displayName;
    hostile.identity.address = "1420 WILLOW CREEK DR";
    hostile.identity.flags.push(`SSN ${crs.requests.tu.ssn} seen at 95125-1234, call 408-555-1212 or a@b.com`);
    const input = buildUnderwriterInput(
      { purpose: `${p.defaultIntake.purpose} ssn ${crs.requests.tu.ssn}`, amountRequested: p.defaultIntake.amountRequested, statedIncome: p.defaultIntake.statedIncome },
      hostile,
      POLICIES.cu,
      null,
    );
    const bad = keysOf(input).filter((k) => FORBIDDEN_KEYS.test(k));
    assert.deepEqual(bad, [], `${id}: forbidden keys ${bad}`);
    const json = JSON.stringify(input);
    assert.ok(!SSN_DASHED.test(json), `${id}: ###-##-#### present`);
    assert.ok(!NINE.test(json), `${id}: 9-digit run present`);
    for (const piece of [crs.displayName, crs.requests.tu.addresses[0].addressLine1, crs.requests.tu.ssn, crs.requests.identity.dob]) {
      assert.ok(!json.toUpperCase().includes(String(piece).toUpperCase()), `${id}: leaked ${piece}`);
    }
  }
});

test("compliance input carries a name placeholder, never the name", () => {
  const input = buildComplianceInput(
    { purpose: "debt consolidation", amountRequested: 9000, statedIncome: 58000 },
    [{ lender: "cu", classification: "deny", offered: null, reasons: [{ text: "FICO 600 is below 660.", field: "credit.fico9" }] }],
  );
  assert.equal(input.applicant.name, NAME_TOKEN);
  assert.deepEqual(keysOf(input).filter((k) => /^(address|zip|ssn|dob|phone|email|raw)$/i.test(k)), []);
  assert.equal(fillName(`Dear ${NAME_TOKEN},`, "Jane Roe"), "Dear Jane Roe,");
});

test("scrubText redacts SSN, phone, email, ZIP+4", () => {
  const s = scrubText("a 666-70-1001 b 666701001 c 408-555-1212 d x@y.io e 95125-1234 f $12500");
  assert.ok(!/666|408|x@y|95125/.test(s));
  assert.ok(s.includes("$12500"));
});

test("card codes: 20 unique, 4 digits 2-9, match design/card-codes.json", () => {
  const codes = Object.values(personaCodes);
  assert.equal(codes.length, 20);
  assert.equal(new Set(codes).size, 20);
  for (const c of codes) assert.match(c, /^[2-9]{4}$/);
  assert.ok(!/[01]/.test(CARD_CODE_ALPHABET));
});

test("embedded card codes equal design/card-codes.json", () => {
  const shared = JSON.parse(readFileSync(new URL("../design/card-codes.json", import.meta.url), "utf8")).codes;
  assert.deepEqual(personaCodes, shared);
});
