# UI references for the underwriting console

Research date: 2026-10-24. Scope: live underwriting console (left applicant queue, central work surface with pipeline rail + three lender columns, right inspector, audit log + eval panel).

Method note: pages were pulled with a text-only fetcher, so "what the screenshot shows" below is reconstructed from captions, alt text, docs text that describe the screen, plus working knowledge of these products. Where a page is confirmed to carry a real product screenshot or video, the direct asset URL is listed so the team can open it. Vendors whose public pages carry no real screenshots (Taktile, Oscilar, Column, Increase, Zest AI, Height) are called out as such; do not expect to copy pixels from them.

---

## A. Underwriting / decisioning engines

### 1. Inngest-style "trace" is not here; start with Alloy (Application Queue + review)

- Product: Alloy (identity + credit decisioning, manual review queue)
- URL with UI: https://www.alloy.com/blog/product-updates-july-2026 (inline product images: "Alloy's AI Assistant" chain-of-reasoning panel, "New dashboard navigation"; asset: https://alloy-website.files.svdcdn.com/production/inline_Alloy%E2%80%99s-AI-Assistant.svg). Companion: https://www.alloy.com/blog/alloy-q4-product-update-fraud-identity (review-interface redesign that hides empty data panels).
- What the images show: a left-nav app with an Application Queue table (one row per applicant, outcome column), an application detail page made of stacked "data panels" (one per data source / check), and a newer AI-assistant pane that streams the agent's step-by-step reasoning (which sources it checked, what it concluded) while a human watches.
- Copy: (a) the outcome vocabulary and its placement — Approved / Denied / Manual Review as a single, fixed-width status cell at the start of each queue row; (b) "hide empty panels" — only render inspector sections that have data; (c) a streaming reasoning pane that lists each source consulted as its own line with a checkmark when done — this is exactly the lender-agent column pattern.
- Avoid: Alloy's detail page is a long vertical scroll of panels; our work surface must stay one viewport tall with the three lender columns side by side.

### 2. Sardine — alert table + "Make decision" + bulk decision modal

- Product: Sardine (fraud/AML case management)
- URL with UI: https://www.sardine.ai/blog/product-updates-september-2026 — two real screenshots: alert management table (rows tagged with queue names such as "L2 Structuring", "Structuring Queue", a "Make decision" button) https://cdn.sanity.io/images/0wqw06cw/production/b1d2cce425965dab24a29f55939636c3fab0827c-2186x1236.png and the "Bulk Decision" modal https://cdn.sanity.io/images/0wqw06cw/production/b0c881ca90a7bb025171e694fd43ab48f14da350-2169x2059.png . Also https://www.sardine.ai/fraud-investigator and the Q1-2024 post describing the customer timeline view.
- What the screenshots show: a dense light-mode table (checkbox, alert id, queue pill, risk level, age, assignee) with a single primary action button in the toolbar; the decision modal has a decision select, a required comment field, and an informational banner that blocks resolving incomplete reviews.
- Copy: the decision modal pattern for the human approve step — decision radio, mandatory rationale textarea, a guard banner ("2 lender offers still pending") that disables the confirm button; the queue pill (small, neutral-gray, monospace-ish) that labels which queue an item sits in.
- Avoid: Sardine's row density comes with 10+ columns; keep our queue to 4 visible fields (name, amount, stage, age).

### 3. Inscribe — risk badge + signal list, the model for the "hard stop" card

- Product: Inscribe AI (document fraud / credit analysis for lenders)
- URL with UI: https://www.inscribe.ai/document-processing/document-verification-for-lenders — screenshots: pay stub flagged "High Risk" with "AI-generated content" as primary signal https://cdn.prod.website-files.com/6238f829b2fff968a3f5913c/6a39eee940d3615d8e571ac6_00fc7b90.png ; risk-analysis dashboard https://cdn.prod.website-files.com/6238f829b2fff968a3f5913c/6a39eee940d3615d8e571acd_2b4edd2b.png
- What the screenshots show: a document viewer on the left, a right rail with a large trust score (e.g. "22"), a colored risk tier badge, and a vertical list of named fraud signals (text edits, added content, software traces, date inconsistencies), each with a short explanation.
- Copy: the right-rail layout of score number (big, mono) + tier badge + ranked list of reasons; this is how the inspector should present "why declined" and how the compliance agent's reason codes should read.
- Avoid: Inscribe uses saturated red fills for whole panels; use a red hairline/left-border and a red word instead of a red card.

### 4. Ocrolus Inspect — discrepancy list with reviewer attribution

- Product: Ocrolus Inspect (mortgage QC)
- URL with UI: https://docs.ocrolus.com/docs/analyze-inspect (screens Insights.png, Inspect_2.png, Inspect_3.png embedded) and demo video https://www.ocrolus.com/video/ocrolus-inspect-demo-automating-loan-processing-eliminating-discrepancies-for-mortgage-lenders/
- What the screenshots show: tabs (Insights / Conditions / Doc expiration with a count badge "Doc expiration (3)"), insights grouped by type (field mismatch, missing documentation, unreported item), each insight opening to show description, source document, and the matching 1003 field; actions "Create condition / Add to 1003 / Ignore"; reviewed items keep reviewer name + timestamp.
- Copy: the tab count badge; grouped discrepancy list with three inline actions; persisting "Reviewed by X at HH:MM" on each item — reuse for the audit log rows.
- Avoid: Ocrolus hides the resolution state in a filter; our rows should show state inline.

### 5. Taktile — decision replay and case manager (text-only reference)

- Product: Taktile (decision platform; flows, cases, traceability)
- URLs: https://taktile.com/product/cases , https://taktile.com/product/traceability , press image credited to Taktile in https://techcrunch.com/2025/02/27/taktile-helps-fintechs-build-automated-decision-making-workflows/ , G2 screenshots https://www.g2.com/products/taktile/reviews
- What is shown/described: a node-graph decision flow canvas (light canvas, rounded nodes, typed edges), a Case Manager where reviewers get "all the context in one window", and "decision replay" that steps through every input, rule, model, agent and human action with a natural-language summary per step.
- Copy: the replay concept — our pipeline rail should be re-scrubbable after the run finishes, each step showing input → output → duration; and the one-window principle for the case view.
- Avoid: Taktile's public site has no honest UI screenshots, so do not model chrome on it; take the information architecture only.

(Oscilar, Unit21, Zest AI: no public screenshots found; Unit21 docs are behind a login. Oscilar's case-management page https://oscilar.com/solutions/case-management describes KPI cards, "jump-to navigator" and AI case summaries — the "AI case summary at top of the case" placement is worth copying for the inspector header.)

---

## B. Fintech ops

### 6. Modern Treasury — dashboard redesign write-up

- Product: Modern Treasury (payment ops)
- URL with UI: https://www.moderntreasury.com/journal/behind-the-scenes-designing-our-new-ui — five full screenshots: new dashboard https://cdn.sanity.io/images/8nmbzj0x/production/45437940322dd1ff685c7dbf6123331ce5ac5f32-1999x1092.png ; reconciliation insights https://cdn.sanity.io/images/8nmbzj0x/production/0821ddc6958c1d8986f488b1a9ae9e2b04fcfd50-1999x1271.png ; side-by-side reconcile https://cdn.sanity.io/images/8nmbzj0x/production/0d1d90fd3ce096411651b61de8ad04ef3025bdd9-1999x1014.png ; rule builder https://cdn.sanity.io/images/8nmbzj0x/production/29b39cf27fddb8473a659e8acfd11e5fe43409e7-1999x1134.png
- What the screenshots show: white surface, thin gray hairlines, left nav with an "Approvals" count flagged top-left, widgets as flat bordered cards (no shadows), amounts right-aligned in tabular figures, a two-pane reconcile view (transactions left, expected payments right), and rules rendered as plain-language sentences with a JSON toggle.
- Copy: "do not round or truncate data" (show $ amounts and APRs at full precision); the approvals count badge in the nav as the model for the queue header ("4 awaiting decision"); plain-language rule rendering with a JSON toggle for the policy/eval panel.
- Avoid: the dashboard-of-widgets homepage; our console opens straight into the queue + case.

### 7. Mercury — transaction list + detail side panel

- Product: Mercury (business banking)
- URL with UI: https://www.saasframe.io/examples/mercury-transactions-details and https://www.saasframe.io/examples/mercury-transactions-dashboard (real screenshots of the transactions table and the right-side transaction detail panel).
- What the screenshots show: a very quiet light UI — off-white page, white table, 13px rows, muted gray secondary text, counterparty name bold, amount in tabular figures with negative in plain text (not red), status as a small lowercase word with a dot ("pending", "completed"); clicking a row slides a 360-400px detail panel in from the right with a large amount, then stacked key/value sections.
- Copy: the restraint — one accent color, status communicated by a 6px dot plus a word, no filled pills; the side-panel key/value section layout (label 11px muted uppercase left, value 13px right) for the inspector's "bundle" section.
- Avoid: Mercury's generous 48px row height; use 36px in the queue.

### 8. Ramp — approvals workflow and yellow-accent discipline

- Product: Ramp (spend management)
- URL with UI: https://ramp.com/ (home hero image, alt "Bill-creation workflow with amount threshold, department approvals, and vendor notification": https://ramp.com/_next/image?url=%2F_next%2Fstatic%2Fimmutable%2Fmedia%2Fhome-refresh-enterprise-workflow.0tqmzq1sbq-62.webp&w=2048&q=75 ). Secondary: unofficial token write-up https://claudeskills.info/skills/ihlamury/design-skills/ramp-ui-skills/ (Inter, 4px grid, white surfaces, yellow reserved for primary action and focus).
- What the image shows: an approval chain rendered as a vertical sequence of condition and approver cards, connected by a thin line, with the single yellow primary button; everything else is near-black text on white with gray hairlines.
- Copy: one high-chroma accent used only for the one primary action on screen (our "Approve" button) and for focus rings; the vertical card-chain rendering for the pipeline rail.
- Avoid: Ramp's marketing-site rounded corners (16px+); keep radii at 6px for an ops tool.

(Increase and Column: Increase's dashboard is behind login and not publicly screenshotted; Column's homepage https://column.com/ renders HTML mockups of account cards, transaction feeds with relative timestamps ("12 mins ago") and transfer detail panels with status labels — worth a look for mono-figure styling, but not a screenshot source. Brex omitted: nothing publicly better than Ramp/Mercury.)

---

## C. Agent / run observability

### 9. Inngest — waterfall trace with compound bars (best pipeline-rail model)

- Product: Inngest (durable functions)
- URL with UI: https://www.inngest.com/docs/platform/monitor/traces (full textual spec of the view) and https://www.inngest.com/blog/enhanced-observability-traces-and-metrics (screenshots: /assets/blog/enhanced-observability-traces-and-metrics/waterfall-2.png "Inngest's new waterfall view", run-details-2.png "run details").
- What the screenshots show: dark UI, two panels split by a draggable divider; left = run header (run id, duration, queued/started/ended timestamps, Rerun/Cancel actions) over a waterfall where each step is a bar positioned by start time, name + icon left, duration right, 0/25/50/75/100% markers across the top; bar colors: green completed, red failed, gray cancelled/sleep/wait, blue userland span, dotted outline "connecting", and compound bars (short gray queue-delay segment followed by the status-colored execution segment); right = step detail with "Attempt N" badge (red failed, green retried-ok) and Input / Output / Error / Headers / Metadata tabs.
- Copy: the compound bar (gray "waiting" segment + colored "running/done" segment) for each pipeline step; a time brush in the rail header; the detail panel's timing block (Queued at / Started at / Ended at / Delay / Duration) in the inspector.
- Avoid: percent markers alone; show absolute elapsed seconds since the run started, since our runs are ~10-30s.

### 10. Trigger.dev — run inspector with status header and event timeline

- Product: Trigger.dev (background jobs)
- URL with UI: https://trigger.dev/changelog/run-page-inspector (Aug 2024; images run-page-inspector.jpg, run-page-inspector-overview.jpg, run-page-replay.png), https://trigger.dev/changelog/run-page-timeline (Feb 2025; run-timeline-definitions.png, attempt-span-timeline-definitions.png, span-timeline-definitions.png), https://trigger.dev/docs/logging (run-log.png).
- What the screenshots show: dark charcoal UI; left tree of spans with tiny colored status icons, bars to the right in a time-scaled lane; a right inspector whose header is the run status word with icon (Completed / Failed / Executing with a spinner), then a vertical timeline of lifecycle events (Triggered → Dequeued → Started → Completed, each with a relative time and duration between them), then Overview / Detail / Context tabs; "Replay" button with a payload editor.
- Copy: the inspector's lifecycle timeline (stacked events with +Δt between them) for the selected lender or compliance step; status-word-as-header; a Replay action that re-runs the case with an edited bundle (great demo moment).
- Avoid: Trigger's all-dark default is hard to read on a projector; ship light as default and dark as a toggle.

### 11. Braintrust — spans with inline metrics and an evaluators tab (eval panel model)

- Product: Braintrust (LLM evals/observability)
- URL with UI: https://www.braintrust.dev/docs/observe/examine-traces — screenshots: trace-spans-layout-2026-10-23.png, trace-timeline-layout-2026-10-23.png, trace-evaluators-tab.png, trace-display-metrics-2026-10-23.png (hosted on mintcdn.com/braintrust/...).
- What the screenshots show: a row click opens the trace in a right panel (Shift+F for fullscreen); the span tree shows per-row inline metrics (duration, tokens, cost) as small gray mono text; a Timeline tab whose bars can be scaled by duration/tokens/cost and are color-coded by span type; an Evaluators tab listing each scorer with its score and the judge's rationale inline.
- Copy: the Evaluators tab verbatim for our eval panel — scorer name, score chip, one-line rationale, expandable; inline mono metrics on each pipeline step (1.8s · 2.3k tok).
- Avoid: Braintrust's five-tab span detail; our inspector needs at most three (Offer / Trace / Notice).

### 12. Langfuse — responsive timeline that fits the whole run

- Product: Langfuse (LLM tracing)
- URL with UI: https://langfuse.com/changelog/2025-03-19-new-trace-view (video https://static.langfuse.com/docs-videos/new-trace-page.mp4), https://langfuse.com/changelog/2026-08-28-responsive-timeline , https://langfuse.com/docs/observability/overview (screenshot https://langfuse.com/images/docs/tracing-overview.png).
- What the video/screenshots show: Tree/Timeline toggle; timeline rows collapse to one-line bars when zoomed out so the shape of a run (fan-out of tool calls, one long generation) reads before labels do; color by observation type (span / generation / event / tool); double-click to focus; side-peek that reuses the same view at smaller density.
- Copy: the fan-out visual — three lender calls as parallel bars under one parent "offers" bar; the same component rendered at two densities (full in the work surface, mini in the queue row).
- Avoid: free pan/zoom; our runs are short and the rail should be static.

(Temporal Web UI https://docs.temporal.io/web-ui : Timeline / Compact / JSON event-history views and a header of Start, Close, Duration, Run Id — copy the "download full JSON history" affordance for the audit log. Vercel runtime logs https://vercel.com/docs/logs/runtime , screenshot https://7nyt0uhk7sse4zvn.public.blob.vercel-storage.com/front/docs/observability/request-log-overview-light.png : copy the row structure [time · level dot · status · duration · path · message] and the "Live" toggle; amber for warning, red for error only.)

---

## D. Queue / inspector patterns

### 13. Linear — Triage inbox with numbered keyboard actions

- Product: Linear
- URL with UI: https://linear.app/docs/triage — screenshots https://webassets.linear.app/images/ornj730p/production/30183e73c9ef009bb8cb14adbe97d9f34a5b9a69-2352x1632.png and https://webassets.linear.app/images/ornj730p/production/c40aa85cbcf9b1ae058bd94c2fb3dd7d2017270a-1784x515.png , video https://www.youtube.com/watch?v=PvHL2QZ3GFM ; plus https://linear.app/docs/peek (Space-bar peek).
- What the screenshots show: 3-pane app — thin left nav, a 320px list of incoming issues (priority glyph, id in mono gray, title, assignee avatar, age right-aligned), and the issue detail with a right properties column (Status, Priority, Assignee, Labels as 12px rows); a bottom action bar on triage items: Accept (1), Decline (2), Duplicate (3), Snooze (H); Decline prompts a comment.
- Copy: the exact left-list anatomy for our applicant queue (stage glyph, short id mono, name, amount, age); the numbered keyboard shortcuts for Approve (1) / Decline (2) / Hold (H) with a required rationale on decline; the quiet selection state (2px accent bar on the row's left edge, 4% tinted background).
- Avoid: Linear's pervasive 12-13px gray-on-gray; lift body text contrast to WCAG AA for an ops tool.

### 14. Attio — record overview as inspector reference

- Product: Attio (CRM)
- URL with UI: https://dribbble.com/shots/26212737-Attio-Record-Overview , https://dribbble.com/shots/26227451-Attio-Record-Pages-Components , gallery https://www.saasui.design/application/attio (25 real screens, e.g. https://cdn.sanity.io/images/alowdh95/production/44203359339629ce5c5301ee05bbfec713a99ac9-1974x1080.png).
- What the shots show: a record page with a 280px left column of attributes (icon + label in 12px muted, value in 13px), a center column of tabs (Activity / Notes / Tasks) over a timeline of activity cards, and small "highlight" widgets at the top; all on white with #E5E7EB hairlines, 6px radii, Inter.
- Copy: the attribute list treatment (icon 14px, label muted, value regular, inline-editable on hover) for the inspector's applicant-bundle section; the activity-timeline card for audit log entries (actor avatar, verb, object, time).
- Avoid: Attio's hover-reveal editing in the inspector; underwriting data must be read-only with a visible provenance line.

(Height.app is offline/redirecting as of this date; omit.)

---

## Synthesis: design spec for the console

Grid at 1440 (12-px gutters, 1px hairlines between panes):
- Queue 272px; work surface 824px; inspector 344px.
- Inside the work surface: pipeline rail 64px on the left; three lender columns 240px each with 12px gaps; a bottom drawer 232px tall shared by Audit log and Eval tabs, collapsible to a 32px bar.
- Row heights: queue 36px; audit/eval rows 28px. Radii 6px. Shadows none; hairlines only.

Type (Inter or Geist Sans for UI; Geist Mono / JetBrains Mono, tabular figures, for numbers and ids):
- Status words: 11px / 600 / uppercase / 0.06em tracking, colored by state.
- APR hero on the offer card: 28px / 600 mono, "%" as 16px / 500 muted suffix; monthly payment 16px / 500 mono.
- Body 13px / 400, line-height 1.45. Labels 11px / 500 muted, uppercase for section headers only.
- Queue row title 13px / 500; secondary 12px muted; ids 11px mono.
- Elapsed timers 11px mono, muted, turning to text color when running.

Palette tokens (light / dark):
- bg #F6F7F9 / #0B0D10
- surface #FFFFFF / #14171C
- hairline #E5E7EB / #23272F
- text #0F172A / #E6E8EB
- muted #64748B / #8B919A
- accent (selection, focus, primary action) #2563EB / #5B8DEF
- approve #16A34A / #3DBE6C
- decline #D97706 / #F0A030
- hard-stop #DC2626 / #F0564E
Rule: color lives in words, dots and 2px edges, never in filled panels. Only one accent-filled button per screen (Approve).

Offer card (one per lender column, 240 wide):
1. Header row: lender name 13px/600 left; status word right (QUOTING · OFFER · DECLINED · HARD STOP) with a 6px dot.
2. Hero: APR 28px mono; under it "$412 / mo · 36 mo" 13px mono muted.
3. Key/value rows (11px label left, 13px mono value right): Amount, Origination fee, Total cost, Conditions.
4. Footer: elapsed "2.4s" mono muted, and a text link "Trace" that opens the inspector.
Empty state: dashed hairline card with a skeleton APR and the same elapsed timer counting.
Declined card: same layout, APR replaced by the primary reason code in 13px/500 decline color; hard-stop uses the hard-stop color and a 2px left edge.

Pipeline rail (64px, vertical): one node per step (Pull bundle → Policy gate → Lender fan-out → Compliance notice → Human decision). Each node is a 10px dot joined by a 1px line; the segment above a running node animates (Inngest compound-bar idea: gray while queued, accent while running, green when done, hard-stop red if the policy gate fails). Beside each dot: step name 11px and elapsed time in mono that counts live and freezes on completion ("1.8s"); the fan-out node shows three stacked mini-bars for the three lenders. A total run time sits at the top in 13px mono.

Inspector (344px): header is the applicant name + the current status word; tabs Offer / Trace / Notice.
- Notice tab renders the adverse-action notice as a document: 12px uppercase label "ADVERSE ACTION NOTICE · DRAFT", the letter body in 13px serifless prose with max 60ch, reason codes as a numbered list where each line shows the code in mono gray and the plain-English reason, then a provenance footer ("Generated by compliance agent · based on Equifax 03-14 · 4 reasons, ECOA §1002.9") and two buttons: Copy and Mark reviewed. Streaming text appears paragraph by paragraph, not character by character.
- Trace tab reuses the Trigger.dev lifecycle timeline (Queued → Started → Completed with +Δt) and Braintrust-style inline metrics.

Three micro-interactions:
1. Offer arrival: the lender card fades from the dashed skeleton and slides up 8px over 180ms; the APR counts from 0 to its value over 400ms in mono so digits don't jitter.
2. Step timers: elapsed mono counters tick at 100ms while running, then snap to two decimals and dim; the rail segment fills top-to-bottom in sync.
3. Decision commit: on Approve, the chosen card gets a 2px approve edge, the other two dim to 60%, and a new audit row slides into the drawer from the top with the actor avatar and timestamp; Decline requires the rationale textarea (Linear/Sardine) before the button enables.

---

## Product name candidates (1-2 syllables, no "credit"/"loan")

1. Docket — the queue of cases awaiting a human ruling; reads as ops, not consumer. Conflicts: several SaaS products named Docket (docket.io legal/meeting tools); domain likely taken, fine for a hackathon.
2. Quorum — three lenders plus one human reaching a decision. Conflicts: Quorum (public-affairs software) and the Quorum blockchain; clear enough in fintech.
3. Verdict — the decision is the product; the adverse-action notice is the written verdict. Conflicts: generic word, multiple legal-tech "Verdict" products; strong meaning, weak trademark.
4. Sieve — the policy gate and lender fan-out filter an applicant into an outcome; one syllable, easy to say. Conflicts: Sieve (video-AI startup), minor.
5. Tenor — the term of an offer, and the tone of a notice; two syllables, underwriting-native. Conflicts: Tenor GIFs (Google-owned) is a large consumer brand; usable as an internal/hackathon name only.

Avoid: Vouch (Vouch insurance), Vantage (VantageScore), Candor (Candor Technology is a mortgage underwriting engine), Ledger (Ledger hardware wallet).
