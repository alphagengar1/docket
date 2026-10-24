# Docket MCP server

Lets an agent (Claude Desktop, Claude Code, your own) drive Docket over MCP. It is a thin stdio wrapper over the HTTP API in `docs/integration.md`.

Tools: `list_applicants`, `get_decision`, `get_trace` (json|text), `start_application`, `approve`, `decline`, `run_eval`, `explain`.

## Build

```sh
cd mcp && npm install && npm run build
```

## Configure

Environment: `DOCKET_API_URL` (the deployment's `.convex.site` URL) and `DOCKET_API_KEY` (the value of `DOCKET_API_KEY` set with `npx convex env set`).

Claude Code:

```sh
claude mcp add docket -e DOCKET_API_URL=https://<deployment>.convex.site -e DOCKET_API_KEY=<key> -- node /abs/path/to/mcp/dist/index.js
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "docket": {
      "command": "node",
      "args": ["/abs/path/to/mcp/dist/index.js"],
      "env": { "DOCKET_API_URL": "https://<deployment>.convex.site", "DOCKET_API_KEY": "<key>" }
    }
  }
}
```

If you publish the package, the `npx` form is `"command": "npx", "args": ["-y", "docket-mcp"]`.

## Example conversation

> **You:** What is waiting for a human?
> *(calls `list_applicants` with `status: awaiting_human`)* Jasmine Reyes (P03), $15,000 for debt consolidation. Best offer: Northstar Lending at 21.9% for 36 months.
>
> **You:** Why did Meridian Bank Prime say no?
> *(calls `get_decision`)* Two reasons, both verified by counterfactual test: her score of 660 is under Meridian's 720 minimum, and utilization of 31% is over its 30% cap.
>
> **You:** Walk me through what happened.
> *(calls `get_trace` with `format: text`)* The bureau file came from a stored fixture in 1.2 s; no hard-stop rule fired; Northstar and Harbor approved; Meridian and Cascade declined; 3 of 3 reasons held up; the notice is drafted and waiting for a loan officer.
>
> **You:** Approve Northstar. I am the loan officer.
> *(calls `approve` with `lender: fintech`)* Recorded as a human approval, source api.

Agents should call `approve` and `decline` only on a person's explicit instruction: a human approves every offer.
