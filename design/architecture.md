# Architecture

Intake chat (Claude) -> Node/Express API -> CRS sandbox (prequal, IDV, fraud)
                                |
                                v
                   Convex: applicants, bundles, offers, turns, auditEvents, evalRuns
                        ^                       |
   webhook (httpAction) |                       v
   Agent runner: runAgent(role, input) -> CREAO run OR direct Claude call (same interface)
                                          React board on Convex live queries (projector)

- backend/: Express, CRS client (login once, cache token; repeated failed logins disable the account), agent runner, intake.
- convex/: schema, mutations, httpActions for webhooks, eval tables.
- web/: React board, persona cards, eval panel.
- policies/: the three underwriting policies as explicit rules + prompt text (teammate).
- personas/: CRS persona -> expected outcome map with reasons (teammate).
- eval/: runs every persona through the pipeline; reports decision agreement, zero-offers-to-fraud, reasons-per-denial (teammate).

Fallback: if no CRS creds by Sat 11:00, data spine becomes Capital One Nessie (mock accounts/transactions, cashflow underwriting). Only backend/crs.ts changes.
