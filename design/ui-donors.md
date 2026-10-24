# UI donors (obscure, copy-closely references)

Research date: 2026-10-24. Replaces the mainstream-heavy `ui-references.md` approach (that file is left as-is). Every image below was downloaded with curl into `design/refs/<slug>/` and viewed; `SOURCE.txt` in each folder has the exact URL. All files are png/jpg/webp under 3 MB. Palettes were sampled from the pixels (quantized), accents eyeballed where noted.

Method: dark.design + minimal.gallery + recent.design (godly now redirects there) mined, then followed out to docs/marketing pages for real in-app screenshots; the user's candidate list triaged site by site. Sites with no real product imagery were dropped (Casca, Parcha, Hummingbird, Peach, Canopy, Runway, Restate, Increase, Bloom, Highnote, Lithic, Prism, Runlayer, AntiMetal, Rig, Mainframe, Paper, Verse, Typefully, Reflect, Kestra welcome screen). Gallery captures of homepages (hero shots) were not kept.

## Keepers (14)

| # | Slug | Site | Files | Role |
|---|---|---|---|---|
| 1 | `laminar` | laminar.sh (was lmnr.ai) | trace-console.png, eval-list.jpg, eval-detail.jpg | **Console shell donor**; eval drawer |
| 2 | `respan` | respan.ai (was keywordsai.co) | trace-waterfall.png, kpi-logs.jpg | **Pipeline / run-trace donor**; KPI row; audit log table |
| 3 | `fey` | fey.com (acquired; via Wayback) | portfolio-holdings.jpg, watchlist-table.png | **Offer card / stat row donor** |
| 4 | `evidence` | evidence.dev | weekly-report.png | **Document (notice) pane donor** |
| 5 | `hyperexpense` | hyperexpense.com (was hypercard.com) | fpa-dashboard.png | Stat tiles with gauges / tick meters |
| 6 | `finary` | finary.com | portfolio-dashboard.png | Stat hero + barcode allocation list + grouped table |
| 7 | `arize-phoenix` | phoenix.arize.com | trace-tree.png, experiment-compare.png | Span tree with hex icons; A/B score columns |
| 8 | `axiom` | axiom.co/docs | query-results.png | Query-builder rows + results table with inline bar fill |
| 9 | `method` | methodfi.com | entity-detail.webp | Light applicant inspector: ruled key/value + accounts table |
| 10 | `lendflow` | lendflow.com | deal-pipeline.png | Real lending pipeline: chevron stage rail, Decline / Submit header |
| 11 | `lightyear` | lightyear.com | account-home.webp | Light three-column shell with right rail |
| 12 | `opik` | comet.com/docs/opik | trace-spans.webp, trace-messages.webp | Light three-pane trace (list / spans / inspector) |
| 13 | `dash0` | dash0.com | span-heatmap.png (small, 788px) | Latency heatmap above spans table; mono attribute chips |
| 14 | `cobalt` | joincobalt.com | insights.png | Four insight tiles with delta pills, compare-period bar |

## What each image does well (concrete)

**laminar/trace-console.png** (1613x1052, dark). Three panes: 190px icon+label nav (items 32px tall, 13px), 800px traces table, 500px inspector. Table rows are 41px with a 3px green status bar at the left edge of each row instead of a status column; columns ID (mono, truncated) / Root span (chip with `{}` icon) / Root input / Root output / Timestamp. A stacked success/error histogram (190px tall, 11-tick y axis) sits above the table with "Total: 991" in grey. Inspector: breadcrumb "Trace ▾ · Chat · Signals (1) · Tags" as 28px pills, a "Failure Detector" card (category chip `logic_error`, description paragraph) in a slightly lighter panel, a mini-Gantt (0s..3m ruler, 4px bars in blue/purple/orange/teal), then a transcript list where every step shows `clock 1.19s · tokens 661 → 18 · $0.0008` as right-aligned 11px mono chips. Near-black on near-black: panels are differentiated by 1px #202020 borders, not fills.

**laminar/eval-list.jpg**, **eval-detail.jpg**. Eval runs list on the left (name + "3 runs" count pill + relative time), score line chart, then a table with Datapoints / Created / score columns where each score is prefixed by a 3x12px red-or-green bar. Detail page: a huge "1" aggregate (56px) above the datapoint table, score tabs as `accuracy 1` pills, and the same transcript/timeline inspector as traces. This is the eval drawer.

**respan/trace-waterfall.png** (2844x1566, 2x, dark). Left: 395px mono runs table (Time with ms, Workflow, Trace ID 6-hex, Duration `8.420s`, Input tokens), 28px rows, selected row has a 2px left accent. Centre: waterfall with a 0.0s / 1.3s / 2.6s ruler, span rows 36px: icon + name + `0.520s · 736t · $0.002100` on a second line, 14px-tall bars (pink = agent, amber = task, teal = generation), nested by indentation with a hairline tree connector. Right: inspector header "Trace 9deeeed" with chip row `Agent · gpt-4o · 2.600s · $0.0071000`, Span / Metadata tabs, Input / Output blocks each with `46w · 291c · Pretty ▾` on the header row.

**respan/kpi-logs.jpg** (2000x1050). Five KPI tiles in a row (each ~380x100): 3px colored left tick, label, big mono number `180.78k`, secondary `0.76%`, delta `▲ 2.4%` top-right, 24-bar sparkline across the bottom. Below: a category timeline (Spans / Errors / Issues / Wins / Info) as rows of colored blocks, then a wide log table with mono headers and a sum/avg sub-header row under Cost and Latency. The best "audit log" table in the set.

**fey/portfolio-holdings.jpg** (2624x1432, 2x, dark). Hero: `$194,614.20` 24px bold with the cents at 60% opacity, label under it in grey 12px; `+64.52%` in a green pill. Holdings table: 38px rows, hairline #1c1c22 separators, ticker in 15px bold white followed by company name in grey, numbers right-aligned in tabular figures, Price bold, change `-$0.12` colored, then a 15px-tall pill `-0.05%` (dark green/red fill, light green/red text, 6px radius). Group headers ("401(k)", "Tech bets") in grey with a subtotal row right-aligned `$128,995.87 +$864.27 (+0.67%)`. Left card "Recent activity" radius 12px with Buy/Sell 24px pills.

**fey/watchlist-table.png**. Same table language plus a 120x30 sparkline cell with a dashed baseline, and a `USD` outlined mono chip.

**evidence/weekly-report.png** (3024x1548, 2x, light). A report that reads as a document: 190px left nav with blue links; a centred 575px column; right 240px "On this page" ToC with a 2px left rule. H1 "Business Review - 2021 W50" ~34px bold sans; body in a serif (~17px, 1.6 line height); H2s 24px sans bold; bullet list of `Label: $55,766`; a stat row (label 13px grey, value 24px, `▲ 5% vs last week` 12px) and grey "Add commentary here..." blocks with a 3px left rule. Exactly the register for an adverse-action letter: sans headings, serif body, numbers inline.

**hyperexpense/fpa-dashboard.png** (1792x1358, dark, cream accent). Black cards radius 12px with 1px #1a1a1a borders. Stat tile: label 16px, value 40px, `+4%` in a dark-green circle pill + "vs. last month" grey. "Policy Compliance" arc gauge built from ~60 cream ticks that fade to grey past 83%; "GL Code Accuracy" 52% as a horizontal tick-bar meter; "Stipends" as a row of mint ticks. Period selectors as 48px outlined dropdowns.

**finary/portfolio-dashboard.png** (2652x1713, dark navy). `1 020 000 €` 56px light; delta `102 000 € ▲10,10 %` green pill; timeframe segmented control (1D 1W 1M 3M...) with a filled active pill; allocation list where each row is label / 40-tick barcode bar / `73,45 %`; grouped collapsible table with `1 actif` count pills and two-line +/- cells (value + % pill).

**arize-phoenix/trace-tree.png**. Header stat row (Trace Status ✓ OK / Total Cost $0.05 / Latency 24.5s) in 16px with 32px values; nested span tree with 32px rounded hex icons (orange = LLM, blue = chain, yellow = tool) and token counts; Info / Annotations 0 / Attributes / Events 0 tabs with count pills; Input / Output blocks with `Text ▾` format select.

**arize-phoenix/experiment-compare.png**. Side-by-side `A Output` / `B Output` columns with `AVG 6.6s · 264.47 · <$0.01` and a score chip `0.73` next to an orange progress bar; per-row stat strips `14.6s · 351 · <$0.01`. Model for comparing three lender offers.

**axiom/query-results.png** (2526x1780, pure black, mono). Query rows as `Dataset ▾ / Where [status == 200] / Summarize [count()] by [geo.country]` pill chips; results table 56px rows, color swatch cell, right-aligned count column with a translucent blue bar filling the cell from the right proportional to the value.

**method/entity-detail.webp** (1622x2048, light). Name 26px bold, mono id `ent_…` + `● Active` pill; "Overview" key/value grid in two columns (label grey 15px, value black); tables with 44px rows, favicon avatar + name + `(•••• 4582)`, status pills with 6px dot (green Active, red Disabled, black Closed), `acc_` mono ids, balances right-aligned. Hairline rules only, no card chrome.

**lendflow/deal-pipeline.png** (2160x1098, light). Applicant header: name 30px + status chips (`APP STARTED`, `PREQUAL: 25%`); red-tinted `Decline` and green `Submit to Placement` buttons; chevron stage rail APPLICATION ✓ > UNDERWRITING (filled blue) > PLACEMENT > OFFER > CLOSING > FUNDED; "Orchestration run" card with provider-logo clusters per check (KYB, KYC, Litigation, Personal Credit) and a `MASTER: NOT STARTED` chip. Domain-exact vocabulary.

**lightyear/account-home.webp**, **cobalt/insights.png**, **opik/*.webp**, **dash0/span-heatmap.png**: see the table; secondary references for shell variants (light three-column, four-tile insight row, light trace three-pane, span heatmap + attribute chips).

## Donor copy sheets

### A. Console shell: Laminar (`refs/laminar/trace-console.png`)

Measurements (CSS px, inferred from a ~1490px-wide app area):
- Columns: nav 190 / work surface 800 (flex) / inspector 500. Nav items 32px tall, 13px text, 8px icon gap, active item has a #1c1c1c fill, radius 6.
- Top bar 44px with "traces" title 16px medium and a Traces / Spans / Sessions segmented control (28px, radius 6, active = #2a2a2a).
- Toolbar row 36px: outlined 28px buttons (`Add filter`, `Columns`, `Default view ▾`, `13d` chip + date range, `Refresh`). Search input 36px, radius 6.
- Table: header 34px uppercase-free grey 12px; rows 41px; 1px #1f1f1f dividers; 3px status bar flush-left in each row; mono 12px for ids.
- Inspector: header 36px with pills; panels separated by 1px borders; mini-Gantt 150px tall; transcript rows 40px with right-aligned mono metric chips.
- Radii: 6px controls, 8px cards. Font: Inter-like grotesk, 12 to 13px body, 11px chips.

Palette (sampled): bg #080808 / #101010; panel #181818; border #202020 / #2a2a2a; text #d8d0d0 (primary), #707070 (secondary); success #30d098; warning/amber #c88808; link/blue #4070a8; selection #385880; peach accent #d8a890.

Copy exactly:
1. Status is a 3px colored bar on the row's left edge, never a text column.
2. Per-step metric chips in the transcript: `⏱ 1.19s  ⌁ 661 → 18  $ 0.0008`, 11px mono, right-aligned, grey until hovered.
3. The "Failure Detector" card: one category chip + one plain-English sentence; put the compliance agent's hard-stop verdict in this exact card.
4. Histogram above the table with a two-line tooltip (`success 21 / error 0`) and `Total: 991` under it.
5. Panels differ by 1px borders only; no drop shadows anywhere.

### B. Offer card and stat tiles: Fey (`refs/fey/portfolio-holdings.jpg`, `watchlist-table.png`) with Hyperexpense for meters

Measurements (CSS px, image is 2x):
- Table rows 38px, hairline dividers, 16px horizontal cell padding. Ticker 15px/600 white + name 15px/400 #8a8a92 on one line.
- Numbers 15px tabular, right-aligned; primary number (Price) 600 weight; delta number colored; delta pill 15px tall, padding 0 8px, radius 6, 13px/500 text.
- Hero stat: 24px/600 with the fractional part at 60% opacity; caption 12px #8a8a92 directly under; secondary stat beside it with its pill.
- Group header 14px #8a8a92, 48px tall; group subtotal row right-aligned 14px/600 + grey delta.
- Cards radius 12px, fill #111114, no border. Sparkline cell 120x30 with a 1px dashed baseline.
- Hyperexpense tile: 40px value, pill `+4%` in a 36px dark-green circle, meters made of 2x14px ticks at 4px pitch.

Palette (sampled + eyeballed accents): bg #080810; card #111114 / #181820; divider #1c1c22; text #ffffff, #8a8a92 secondary; green text #3dd68c on pill #15302a; red text #e5484d on pill #3a1a1f; Hyperexpense cream accent #f0e8d0, mint #b0f8d8, deep green #187048.

Copy exactly:
1. Every lender offer is one Fey row: lender badge + name, then APR / term / amount / monthly as tabular numbers, then a colored delta pill versus the best offer.
2. Dim the cents, keep the dollars: `$194,614` + `.20` at 60%.
3. Pills carry the sign and the color; the adjacent raw number is colored too, but never bold.
4. Group header + subtotal row pattern for "Offers (3)" with a best-offer summary line on the right.
5. Credit stats as Hyperexpense tick meters (utilization, DTI) with the `+x% vs` circle pill, not progress bars.

### C. Document-like notice pane: Evidence (`refs/evidence/weekly-report.png`), with Method for the ruled metadata header

Measurements (CSS px, image is 2x):
- Column width 575px centred in the pane, 48px top padding, 32px side padding when the pane is narrower.
- H1 34px/700 sans, 1.15 line height, 8px above the dateline. Dateline 17px serif grey.
- H2 24px/700 sans with 40px above / 16px below. H3 18px/700.
- Body 17px serif (Georgia-class), 1.6 line height, #1f2937; bullets with 8px indent; inline numbers set in the same serif.
- Stat row: three tiles, label 13px grey, value 24px/500 sans, delta 12px with ▲/▼ glyph and "vs last week" grey.
- Commentary / signature block: 3px left rule #d1d5db, 12px left padding, placeholder italic grey.
- Right ToC: 240px, 13px, 2px left rule, 36px per item.
- Method header for the top of the notice: name 26px, mono id, `● Active` pill; key/value grid two columns, 40px rows, 1px #e5e7eb rules.

Palette (sampled): page #f8f8f8; panel #f0f0f8; rules #e8e8e8 / #c0c8c8; text #1f2937 (eyeballed), muted #6b7280; link/accent #70a0d0 (Evidence blue), nav link #2563eb-class; Method status green #22c55e, red #ef4444.

Copy exactly:
1. Sans headings, serif body; the letter must not look like app chrome.
2. Reason codes as the bulleted `Label: value` list (`Debt-to-income ratio: 48%`).
3. A ruled key/value header (applicant, application id, date, decision) above the prose, Method-style.
4. Signature / disclosure block with the 3px left rule.
5. Right-hand mini-ToC (Decision, Principal reasons, Your rights, Credit score disclosure) that scrolls the pane.

### D. Pipeline / run trace: Respan (`refs/respan/trace-waterfall.png`), Laminar Gantt as the compact variant

Measurements (CSS px, image is 2x):
- Three panes 395 / 300 / 300 inside a 1422px frame; top bar 40px with breadcrumb `Trace 9deeeed / Span d5226cc` 15px mono + copy icons.
- Runs table: header 28px, rows 28px, mono 12px, columns Time 200 / Workflow 220 / Trace ID 110 / Duration 110 (right) / Input 90 (right); selected row #181820 with 2px pink left accent.
- Waterfall: ruler 24px (0.0s, 1.3s, 2.6s); span rows 36px, two-line label (name 13px, metrics 12px mono grey); bars 14px tall, radius 4, positioned proportionally; tree indent 16px per level with a 1px #2a2a30 connector.
- Inspector: title 22px/600; chips row 24px, radius 6, #181820 fill; tabs 32px with 2px underline; Input / Output blocks: header 32px with `46w · 291c` and `Pretty ▾`, body 15px, 16px padding, radius 8.

Palette (sampled): bg #080808; panel #101018; row alt #181820; border #202028; text #e0e0e0, grey #8a8a92; agent pink #f86080; task amber #f8b040; generation teal #60d0c8; red dim #984858; status green (check 200) #30d098.

Copy exactly:
1. Vertical rail = the span tree: one color per actor (orchestrator pink, lender agents amber, compliance teal), bars grow in real time.
2. Second-line metrics under each span: `0.520s · 736t · $0.0021`.
3. Selected span opens the Input / Output blocks in the inspector with the `46w · 291c` word/char counter.
4. Breadcrumb with copyable short ids (`9deeeed`), 7 chars, mono.
5. "End of all traces matching filters in the last 5 minutes" style footer line + `21 traces` count with a refresh icon, bottom-right of the queue.

## Mapping to the console

- Queue (left): Laminar traces table rows (41px, status bar) with Fey-style numeric cells for amount.
- Work surface: Lendflow chevron stage rail on top; Respan waterfall as the vertical pipeline rail; three lender columns are Fey rows inside Phoenix `A Output / B Output` column headers.
- Inspector (right): Hyperexpense tick-meter stat tiles, then the Evidence-styled notice pane with a Method key/value header.
- Bottom drawer: Respan log table for the audit log; Laminar eval-list (score bars) for eval metrics.
