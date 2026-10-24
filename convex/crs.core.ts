// Pure CRS (StitchCredit) sandbox logic: which products to call, in what order,
// and how to normalize the raw responses into the bundle shape of contracts.md.
// No Convex imports and no globals except fetch-free interfaces, so the same code
// runs inside the Convex action (crs.ts), in node:test, and in the fixture
// capture script. Authentication/token caching lives in crs.ts.
//
// Facts verified against the live sandbox on 2026-10-24 (see convex/fixtures/crs):
//  - login: POST /users/login -> {token, expires: 3600, refreshToken}
//  - credit order POST /{tu|efx|exp}/credit-report/standard/<product> returns the
//    FULL report and a RequestID response header; POST .../<product>/{RequestID}
//    ("retrieve") returns the identical body, so we only retrieve when the order
//    response has no creditFiles (or opts.alwaysRetrieve).
//  - The TransUnion product named tu-prequal-fico9 returns "TransUnionVantageScore4.0"
//    for every file-returned persona (only P15's frozen file lists "FICO Score 9",
//    without a value). credit.fico9 therefore uses that TU score as a PROXY and the
//    bureaus summary says which model it really was.
//  - FraudFinder risk.score is already 0-100, higher = riskier. Mapping is identity.
//  - Criminal/eviction new-request return results inline; get-response 404s.
import type { BundleData, Tradeline } from "./types";

/** True for a lien or judgment record that is still outstanding (status not released/satisfied/paid/vacated/dismissed). */
const isOutstanding = (status: unknown) => !/^\s*(released|satisfied|paid|vacated|dismissed|settled)/i.test(String(status ?? ""));
const isEvictionType = (type: unknown) => /unlawful detainer|evict/i.test(String(type ?? ""));

/**
 * flags.lienOrJudgment: at least one unsatisfied tax/other lien or unsatisfied civil judgment in the
 * BLJ public-records summary (extras.publicRecords). Eviction judgments are excluded: they already
 * set flags.eviction. Used by the live normalizer and when serving captured fixtures.
 */
export function lienOrJudgmentFromPublicRecords(pr: any): boolean {
  if (!pr) return false;
  const liens = Array.isArray(pr.lienDetail) ? pr.lienDetail : [];
  const judgments = Array.isArray(pr.judgmentDetail) ? pr.judgmentDetail : [];
  return liens.some((l: any) => isOutstanding(l?.status)) || judgments.some((j: any) => !isEvictionType(j?.type) && isOutstanding(j?.status));
}

export type CrsRequests = {
  tu: Record<string, any>;
  efx: Record<string, any>;
  exp: Record<string, any>;
  identity: Record<string, any>;
  fraud: Record<string, any>;
  blj: Record<string, any>;
  criminal?: Record<string, any>;
  eviction?: Record<string, any>;
};

export type HttpResult = { status: number; ms: number; requestId: string | null; json: any; text?: string };
export type CrsHttp = {
  /** Must throw CrsAuthError on a 401 (and never re-login). */
  request(method: "GET" | "POST", path: string, body?: unknown): Promise<HttpResult>;
};
export class CrsAuthError extends Error {}

export type PullOptions = {
  includeCriminal?: boolean;
  includeEviction?: boolean;
  alwaysRetrieve?: boolean;
  /** pause between sandbox calls */
  delayMs?: number;
};

export type ProductRecord = {
  ok: boolean;
  status: number | null;
  ms: number;
  requestId: string | null;
  json: any;
  retrieved?: boolean;
  error?: string;
};
export type RawPull = {
  products: Record<string, ProductRecord>;
  calls: number;
  totalMs: number;
};

export const PATHS = {
  tu: "/transunion/credit-report/standard/tu-prequal-fico9",
  efx: "/equifax/credit-report/standard/efx-prequal-vantage4",
  exp: "/experian/credit-report/standard/exp-prequal-vantage4",
  identity: "/transunion/identity-manager-verification/basic",
  fraud: "/fraud-finder/fraud-finder",
  blj: "/pp/fcrablj/data",
  criminal: "/criminal/new-request",
  eviction: "/eviction/new-request",
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function pullRaw(http: CrsHttp, req: CrsRequests, opts: PullOptions = {}): Promise<RawPull> {
  const delay = opts.delayMs ?? 250;
  const products: Record<string, ProductRecord> = {};
  let calls = 0;
  let totalMs = 0;
  let authFailed = false;

  async function one(method: "GET" | "POST", path: string, body: unknown): Promise<HttpResult | null> {
    calls++;
    try {
      const r = await http.request(method, path, body);
      totalMs += r.ms;
      return r;
    } catch (e: any) {
      if (e instanceof CrsAuthError) authFailed = true;
      throw e;
    }
  }

  async function product(key: string, path: string, body: any | undefined, credit: boolean) {
    if (!body) return;
    if (authFailed) {
      products[key] = { ok: false, status: 401, ms: 0, requestId: null, json: null, error: "skipped: earlier 401 (no login retry)" };
      return;
    }
    try {
      const o = await one("POST", path, body);
      const rec: ProductRecord = { ok: !!o && o.status >= 200 && o.status < 300, status: o?.status ?? null, ms: o?.ms ?? 0, requestId: o?.requestId ?? null, json: o?.json ?? null };
      if (o && !rec.ok) rec.error = `HTTP ${o.status}: ${(o.text ?? JSON.stringify(o.json) ?? "").slice(0, 300)}`;
      if (credit && rec.ok && (opts.alwaysRetrieve || (!rec.json?.creditFiles && rec.requestId))) {
        await sleep(delay);
        const r = await one("POST", `${path}/${rec.requestId}`, body);
        if (r && r.status >= 200 && r.status < 300 && r.json) {
          rec.json = r.json;
          rec.retrieved = true;
          rec.ms += r.ms;
        } else if (r) rec.error = `retrieve HTTP ${r.status}`;
      }
      products[key] = rec;
    } catch (e: any) {
      products[key] = { ok: false, status: e instanceof CrsAuthError ? 401 : null, ms: 0, requestId: null, json: null, error: String(e?.message ?? e).slice(0, 300) };
    }
    await sleep(delay);
  }

  await product("tu", PATHS.tu, req.tu, true);
  await product("efx", PATHS.efx, req.efx, true);
  await product("exp", PATHS.exp, req.exp, true);
  await product("identity", PATHS.identity, req.identity, false);
  await product("fraud", PATHS.fraud, req.fraud, false);
  await product("blj", PATHS.blj, req.blj, false);
  if (opts.includeCriminal) await product("criminal", PATHS.criminal, req.criminal, false);
  if (opts.includeEviction) await product("eviction", PATHS.eviction, req.eviction, false);
  return { products, calls, totalMs };
}

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------
export type BureauStatus = "ok" | "no_file" | "frozen" | "error";
export type BureauSummary = { status: BureauStatus; score: number | null; model?: string | null; note?: string };
export type Bureaus = { tu: BureauSummary; efx: BureauSummary; exp: BureauSummary };

export type Normalized = {
  bundle: BundleData;
  bureaus: Bureaus;
  /** One line per degraded product / judgement call. */
  notes: string[];
  /** Facts that have no contract field (liens, judgments, criminal record ...). */
  extras: Record<string, any>;
};

const numOf = (x: unknown): number | null => {
  if (x === null || x === undefined || x === "") return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
};
const arr = (x: any): any[] => (Array.isArray(x) ? x : x == null ? [] : [x]);

function bureauSummary(j: any, kind: "tu" | "efx" | "exp"): BureauSummary & { fico9Score?: number | null } {
  if (!j) return { status: "error", score: null, note: "no response" };
  const errs = arr(j.errorMessages);
  if (errs.length) {
    const text = errs.map((e: any) => `${e.creditErrorMessageCode ?? ""} ${e.creditErrorMessageText ?? ""}`.trim()).join("; ");
    return { status: "error", score: null, note: text.slice(0, 200) };
  }
  const resultStatus: string = j.creditFiles?.[0]?.creditFileDetail?.creditFileResultStatusType ?? "";
  const scores = arr(j.scores);
  const withValue = (re: RegExp) => scores.find((s: any) => re.test(String(s?.modelName ?? "") + " " + String(s?.modelNameType ?? "")) && numOf(s?.scoreValue) != null);
  let score: number | null = null;
  let model: string | null = null;
  if (kind === "tu") {
    const s = withValue(/fico.*9|score 9/i) ?? scores.find((x: any) => numOf(x?.scoreValue) != null);
    score = numOf(s?.scoreValue);
    model = s?.modelName ?? scores[0]?.modelName ?? null;
  } else {
    const s = withValue(/vantage|\bv4\b/i);
    score = numOf(s?.scoreValue);
    model = s?.modelName ?? null;
  }
  if (/freeze/i.test(resultStatus)) return { status: "frozen", score: null, model, note: resultStatus };
  if (/nofile|nohit/i.test(resultStatus) || (!resultStatus && !j.creditFiles)) return { status: "no_file", score: null, model, note: resultStatus || "no credit file" };
  const noScore = scores.find((s: any) => s?.noScoreReasonType)?.noScoreReasonType;
  return { status: "ok", score, model, note: score == null && noScore ? `no score: ${noScore}` : undefined };
}

function mapTradeline(t: any): Tradeline {
  const loan = String(t?.loanType ?? "");
  const acct = String(t?.accountType ?? "");
  const type = /creditcard|chargeaccount/i.test(loan)
    ? "credit_card"
    : /mortgage|realestate/i.test(loan) || /mortgage/i.test(acct)
      ? "mortgage"
      : /auto/i.test(loan)
        ? "auto"
        : /student|education/i.test(loan)
          ? "student_loan"
          : /collection/i.test(loan)
            ? "collection"
            : /installment/i.test(acct)
              ? "personal_loan"
              : acct.toLowerCase() || "unknown";
  const rating = String(t?.currentRatingType ?? "");
  const state = String(t?.accountStatusType ?? "");
  let status: string;
  if (/collection/i.test(rating) || type === "collection") status = "collection";
  else if (/chargeoff/i.test(rating)) status = "charge_off";
  else if (/late(\d+)/i.test(rating)) status = (/late(\d+)/i.exec(rating)![1] === "30" ? "open_30dpd" : "open_" + /late(\d+)/i.exec(rating)![1] + "dpd");
  else if (/paid|closed/i.test(state)) status = "closed";
  else status = "open";
  return { type, balance: numOf(t?.currentBalanceAmount) ?? 0, status, openedAt: String(t?.accountOpenedDate ?? "") };
}

function utilizationOf(j: any): number | null {
  const u = numOf(j?.summaries?.tradeSummary?.revolvingCreditUtilization);
  if (u != null) return Math.round(u) / 100;
  const rev = arr(j?.tradelines).filter((t: any) => /revolving/i.test(t?.accountType ?? "") && /open/i.test(t?.accountStatusType ?? ""));
  const lim = rev.reduce((a: number, t: any) => a + (numOf(t?.creditLimitAmount) ?? 0), 0);
  if (!lim) return null;
  const bal = rev.reduce((a: number, t: any) => a + (numOf(t?.currentBalanceAmount) ?? 0), 0);
  return Math.round((bal / lim) * 100) / 100;
}

export function normalizeProducts(p: Record<string, ProductRecord | undefined>): Normalized {
  const notes: string[] = [];
  const extras: Record<string, any> = {};
  const j = (k: string) => (p[k]?.ok ? p[k]!.json : null);
  for (const k of ["tu", "efx", "exp", "identity", "fraud", "blj"]) {
    if (p[k] && !p[k]!.ok) notes.push(`${k}: ${p[k]!.error ?? "failed"}`);
    else if (!p[k]) notes.push(`${k}: not called`);
  }

  // ---- bureaus + scores ---------------------------------------------------
  const tu = bureauSummary(j("tu"), "tu");
  const efx = bureauSummary(j("efx"), "efx");
  const exp = bureauSummary(j("exp"), "exp");
  const bureaus: Bureaus = {
    tu: { status: tu.status, score: tu.score, model: tu.model, note: tu.note },
    efx: { status: efx.status, score: efx.score, model: efx.model, note: efx.note },
    exp: { status: exp.status, score: exp.score, model: exp.model, note: exp.note },
  };
  if (tu.score != null && !/fico.*9|score 9/i.test(String(tu.model))) {
    notes.push(`credit.fico9 is a proxy: the tu-prequal-fico9 product returned ${tu.model} = ${tu.score} (sandbox does not issue FICO 9 values).`);
  }
  const vantage4 = efx.score ?? exp.score ?? null;
  if (efx.score != null && exp.score != null && efx.score !== exp.score) notes.push(`vantage4: EFX ${efx.score} and EXP ${exp.score} differ; used EFX.`);
  const scores = [tu.score, efx.score, exp.score].filter((x): x is number => x != null);
  if (scores.length > 1 && Math.max(...scores) - Math.min(...scores) >= 20) notes.push(`bureau divergence: scores range ${Math.min(...scores)}-${Math.max(...scores)} (tu ${tu.score}, efx ${efx.score}, exp ${exp.score}).`);
  const nonOk = (["tu", "efx", "exp"] as const).filter((b) => bureaus[b].status !== "ok");
  if (nonOk.length && nonOk.length < 3) notes.push(`bureau status: ${nonOk.map((b) => `${b}=${bureaus[b].status}`).join(", ")}.`);

  // ---- primary file for tradelines/inquiries/utilization -------------------
  const primaryKey = (["tu", "efx", "exp"] as const).find((b) => bureaus[b].status === "ok");
  const primary = primaryKey ? j(primaryKey) : null;
  const tradelines = arr(primary?.tradelines).map(mapTradeline);
  const reqDate = Date.parse(primary?.responseDetail?.dateRequested ?? "") || Date.now();
  const cutoff = reqDate - 183 * 24 * 3600 * 1000;
  const inquiries6mo = arr(primary?.inquiries).filter((i: any) => {
    const d = Date.parse(i?.inquiryDate ?? "");
    return Number.isFinite(d) ? d >= cutoff : true;
  }).length;
  const utilization = primary ? utilizationOf(primary) : null;
  if (primaryKey && primaryKey !== "tu") notes.push(`tradelines/inquiries/utilization taken from ${primaryKey} (tu was ${bureaus.tu.status}).`);

  // ---- identity -----------------------------------------------------------
  const idj = j("identity");
  const idMsgs = arr(idj?.addOnProducts?.[0]?.idManagerVerification?.messages);
  const codes = new Set(idMsgs.map((m: any) => String(m?.code)));
  const keyMsgs = arr(idj?.custom?.idmanagerVerAnalysisV2?.verificationSummary?.keyMessages?.keyMessages);
  const idFlags = [
    ...idMsgs.map((m: any) => `${m.code} ${m.text}`),
    ...keyMsgs.map((m: any) => `${m.code} ${m.text}`),
  ];
  const allAlerts = [tu, efx, exp].length && ["tu", "efx", "exp"].flatMap((k) => arr(j(k)?.responseAlertMessages));
  const fraudVictim = (allAlerts || []).find((a: any) => /FraudVictim|InitialFraud|ActiveDuty/i.test(a?.responseAlertMessageCategoryType ?? ""));
  if (fraudVictim && !idFlags.some((f) => /fraud alert/i.test(f))) idFlags.push(`FRAUD ALERT ON FILE (${fraudVictim.sourceType ?? "bureau"}): ${fraudVictim.responseAlertMessageText ?? ""}`.slice(0, 200));
  const deceasedId = codes.has("2301") || arr(idj?.addOnProducts?.[0]?.idManagerVerification?.deceases).length > 0;
  let verified: boolean;
  if (!idj) {
    verified = false;
    idFlags.push("identity check unavailable");
    notes.push("identity: no response, failing closed (verified=false).");
  } else {
    verified = !codes.has("2201") && !deceasedId && idj?.fileSummary?.fileHitIndicator !== "NO_HIT";
  }

  // ---- fraud --------------------------------------------------------------
  const fj = j("fraud");
  const risk = fj?.risk;
  const fraudScore = numOf(risk?.score);
  const signals: string[] = [];
  if (fj) {
    if (risk?.tumbling_risk) signals.push("email_tumbling_risk");
    const eam = fj?.eam;
    if (numOf(eam?.velocity) != null && numOf(eam.velocity)! >= 5) signals.push(`email_velocity_high(${eam.velocity})`);
    if (numOf(eam?.longevity) != null && numOf(eam.longevity)! <= 3) signals.push(`email_recently_seen(longevity ${eam.longevity})`);
    const owner = risk?.phone?.owner;
    if (owner && Object.values(owner).some((v) => v === "no_match")) signals.push("phone_owner_name_address_mismatch");
    if (risk?.phone?.line_type === "voip") signals.push("phone_voip");
    if (risk?.phone?.prepaid) signals.push("phone_prepaid");
    if (risk?.phone?.status && risk.phone.status !== "valid") signals.push(`phone_${risk.phone.status}`);
    if (fj?.email_validation?.status && fj.email_validation.status !== "valid") signals.push(`email_${fj.email_validation.status}`);
    if (risk?.postal && Object.entries(risk.postal).some(([k, v]) => /_match$/.test(k) && v === "no_match")) signals.push("postal_mismatch");
    if (/>\s*1000/.test(String(risk?.postal?.ip_postal_distance ?? ""))) signals.push("ip_far_from_address(>1000 miles)");
    if (risk?.ip?.proxy_type) signals.push(`ip_proxy(${risk.ip.proxy_type})`);
    if (risk?.ip?.hosting_facility) signals.push("ip_hosting_facility");
    if (numOf(risk?.domain?.domain_risk_score)) signals.push(`domain_risk(${risk.domain.domain_risk_score})`);
    if (fraudScore == null) notes.push("fraud: response had no risk.score");
  }

  // ---- flags --------------------------------------------------------------
  const bureauErrText = ["tu", "efx", "exp"].flatMap((k) => arr(j(k)?.errorMessages).map((e: any) => String(e?.creditErrorMessageText ?? "")));
  const deceased = deceasedId || bureauErrText.some((t) => /deceased/i.test(t));
  const frozen = (["tu", "efx", "exp"] as const).some((b) => bureaus[b].status === "frozen") || idj?.fileSummary?.creditDataStatus?.freeze?.indicator === true;

  const blj = j("blj")?.DetailedBLJReport;
  const bljB = numOf(blj?.BankruptciesFound) ?? 0;
  const bljL = numOf(blj?.LiensFound) ?? 0;
  const bljJ = numOf(blj?.JudgmentsFound) ?? 0;
  const prs = ["tu", "efx", "exp"].flatMap((k) => arr(j(k)?.publicRecords));
  const bankruptcy = bljB > 0 || prs.some((r: any) => /bankrupt/i.test(r?.publicRecordType ?? "")) || (numOf(primary?.summaries?.derogatorySummary?.bankruptciesCount) ?? 0) > 0;
  const judgments = arr(blj?.Results?.Judgments?.JudgmentRecord);
  const evictionBlj = judgments.some((r: any) => /unlawful detainer|evict/i.test(r?.JudgmentType ?? ""));
  const evj = j("eviction");
  const evictionCic = (numOf(evj?.response?.count) ?? 0) > 0;
  const eviction = evictionBlj || evictionCic || prs.some((r: any) => /evict/i.test(r?.publicRecordType ?? ""));
  if (!j("blj") && p.blj) notes.push("flags.bankruptcy/eviction rely on bureau public records only (BLJ missing).");

  extras.publicRecords = {
    bankruptcies: bljB,
    liens: bljL,
    judgments: bljJ,
    bankruptcyDetail: arr(blj?.Results?.Bankruptcies?.BankruptcyRecord).map((r: any) => ({ chapter: r?.Chapter, status: r?.Status })),
    lienDetail: arr(blj?.Results?.Liens?.LienRecord).map((r: any) => ({ amount: r?.TotalLienAmount, status: r?.Status, by: r?.Plaintiff?.Name?.UnparsedName })),
    judgmentDetail: judgments.map((r: any) => ({ amount: r?.TotalJudgmentAmount, status: r?.Status, type: r?.JudgmentType })),
  };
  const lienOrJudgment = lienOrJudgmentFromPublicRecords(extras.publicRecords);
  const cj = j("criminal");
  if (cj) {
    const cands = arr(cj?.cicCriminal?.candidates?.candidate);
    extras.criminal = { count: cands.length, offenses: cands.flatMap((c: any) => arr(c?.offenses?.offense).map((o: any) => ({ caseType: o?.caseType, disposition: o?.disposition, description: o?.description }))) };
  }
  if (evj) extras.evictionCic = { count: numOf(evj?.response?.count) ?? 0 };
  extras.fraudAlertOnFile = !!fraudVictim;

  return {
    bundle: {
      credit: { fico9: tu.score, vantage4, tradelines, inquiries6mo, utilization },
      identity: { verified, flags: idFlags },
      fraud: { score: fraudScore, signals },
      flags: { deceased, frozen, bankruptcy, eviction, lienOrJudgment },
    },
    bureaus,
    notes,
    extras,
  };
}
