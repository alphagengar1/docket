# Cal Hacks 13.0 project (working name TBD)

Two-person team. Swaraj (UCLA) owns convex/, web/. Teammate (UCB, data science) owns policies/, personas/, eval answer key.

Before touching anything, read design/product.md, design/architecture.md and design/contracts.md. Never change design/contracts.md without the other person; it is the only shared file. Log every decision as a dated one-liner in design/decisions.md; put unanswered questions in design/open.md.

Rules: all code written after Fri Oct 23 18:00 PDT; no code copied from earlier projects. Personas and sandbox data only, no real PII. Every denial carries at least two reasons. A human approves every offer.

Overnight agents: append one line to design/STATUS.md whenever you finish a step or get blocked. Never edit design/contracts.md; if a contract must change, write the proposal in design/open.md and work around it.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
