# Benchmarks behind the add-on slides (Oct 24, 2026)

Numbers on docket-benchmarks.pptx. Docket figures come from the cloud deployment's public queries
(`eval:runs`, `desk:recordedRun`, `desk:listApplicants`, `desk:offers`) read on Oct 24 ~20:30 PDT.

## Agent, CREAO-hosted, five lenders (recordings P01–P20, recorded 15:04–15:21)
- Outcome vs answer key: 20/20 (17 offered or declined, 3 hard stops).
- Per-lender vs `expectedPerLender`: 82/100. 14 misses are `underwrite.failed` schema validation errors
  (`conditions` not an array, `apr` not a number) from the `cu` (9) and `regional` (5) CREAO agents;
  4 are subprime amount-cap cells where the key was derived with different loan amounts (see open.md).
- Output validity: 86/100 lender calls returned schema-valid JSON.
- Reasons verified: 64/76 lender-field pairs (84%). In CREAO mode the counterfactual re-runs use the
  deterministic policy mirror (`underwriteOnce` falls back to the stub for non-claude providers).
- Step medians (s): pull 1.2, hard stops 1.2, underwriting 33.9, verify 1.4, compliance 28.0;
  card code to `step.human.start` median 67.3 (min 40.0, max 97.8, n=17); hard stop at 3.7–9.0 s,
  run complete 5.1–10.2 s (n=3). Per-lender latency median 22.5 s (n=85).

## Agent, Claude direct, three lenders (eval runs)
| Run (PDT) | Agreement | Per-lender | Reasons verified | Lender p50 (s) | Wall clock |
|---|---|---|---|---|---|
| 03:34 | 19/20 | n/a | 75% | 3.0–3.2 | 76 s |
| 03:36 | 19/20 | n/a | 76% | 2.7 | 78 s |
| 03:38 | 20/20 | n/a | 81% | 2.3–2.7 | 75 s |
| 09:31 | 20/20 | 60/60 | 84% | 2.7–3.0 | 70 s |
Both misses are P15 before the single-bureau-freeze rule change. Fraud/deceased/ID-fail personas: zero offers in every run.

## Repeat-run consistency (live applicants)
- P05 at $7,000 / $41,000: run 09:52, 12:53 (3 lenders) and 14:03 (5 lenders): every lender declined each time.
- P08: runs at $25k, $12k, $15k: cu decline, fintech approve 15.90%, prime decline every time.

## Cost estimate (not measured)
Underwriter call ≈ 2,000 input tokens (system + policy 3.0–4.1K chars + bundle ~1K chars) and ~800 output
(JSON + adaptive thinking); ~15 calls per application (5 lenders + ~10 verification re-runs, from 165
reason checks across 17 runs). Compliance (Sonnet 5.5) ≈ 4,000 in, ~1,500 out.
Typical: 15 × (2,000 × $0.10 + 800 × $0.50)/1M + (4,000 × $2 + 1,500 × $10)/1M ≈ $0.032.
Ceiling at the 4,096-token output caps ≈ $0.083.

## Human benchmarks (published)
- Time to decision: banks and credit unions 1–7 business days; online lenders minutes to a day (Bankrate).
- Noise audit: 48 underwriters at an insurance company, median 55% difference on identical cases;
  executives expected ~10% (Kahneman, Sibony, Sunstein, Noise, 2021).
- Decision fatigue: ~26,500 loan restructuring requests; officers less lenient by midday (University of
  Cambridge, reported by ScienceDaily, May 2021).
- Adverse action: notices failing to disclose principal reasons (CFPB Supervisory Highlights, Winter 2020).
- Wage: loan officers median $36.87/hour, May 2025 (BLS Occupational Outlook Handbook).
- CRS (vendor-stated): all three bureaus + identity, fraud, public records; credentialing "in days, instead of
  months"; "40M+ credit pulls", "more than 2,000 companies"; sandbox mirrors production; single normalized JSON.

## Update, Oct 24 ~21:30: CREAO with Claude fallback (commits 5853bf9, ef19ed7)
- Two cloud evals via `eval:runEvalNow` (21:22 and 21:26, 20 personas at once, applicants deleted after).
  The cloud scorer reports 19/20 and 60/60 because the deployed `evalCases` rows are the old three-lender
  key (P06 expected decline; no regional/subprime columns). Re-scored against the current personas/map.json
  from a live snapshot of run 2: outcomes 20/20, per-lender 96/100 (same 4 Harbor amount-cap cells),
  85/85 lender answers valid (81 CREAO, 4 re-run on Claude), reasons verified 82% (eval) / 84% (same method
  as above). Run 1 reasons verified 80%.
- Under load (20 at once): lender median 58 s, card code to officer queue median 155 s, hard stops 15 s;
  each batch finished in about 2.5 minutes.
- Single live run after the fix (P03, 20:58): 62.2 s to the officer queue; pull 1.5, hard stops 1.9,
  underwriting 27.7, verify 1.8, notice 25.8 s; lender latencies 15.5–24.7 s, no fallbacks.
- Output validity denominators corrected to lender calls (non-hard-stop personas × lenders): Claude direct
  51/51; earlier CREAO recordings 71/85.
