#!/usr/bin/env node
// Docket MCP server (stdio). Every tool is a thin call to the Docket HTTP API.
// Env: DOCKET_API_URL (the deployment's .convex.site URL), DOCKET_API_KEY (bearer token).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.DOCKET_API_URL ?? "").replace(/\/$/, "");
const KEY = process.env.DOCKET_API_KEY ?? "";

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  if (!BASE || !KEY) {
    return { ok: false, status: 0, text: "DOCKET_API_URL and DOCKET_API_KEY must be set in the MCP server's environment." };
  }
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };
async function run(method: "GET" | "POST", path: string, body?: unknown): Promise<ToolResult> {
  try {
    const r = await call(method, path, body);
    if (!r.ok) return { content: [{ type: "text", text: `Docket API error ${r.status}: ${r.text}` }], isError: true };
    return { content: [{ type: "text", text: r.text }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Docket API unreachable: ${(e as Error).message}` }], isError: true };
  }
}

const server = new McpServer({ name: "docket", version: "0.1.0" });
const id = z.string().describe("Applicant id (from list_applicants or start_application)");
const status = z.enum(["intake", "pulling", "guardrails", "underwriting", "compliance", "awaiting_human", "approved", "declined", "hard_stop"]);

server.registerTool(
  "list_applicants",
  { description: "List applicants, newest first, optionally filtered by status (e.g. awaiting_human = the human queue). Includes the best approved offer, if any.", inputSchema: { status: status.optional() } },
  async ({ status }) => run("GET", `/applicants${status ? `?status=${status}` : ""}`),
);

server.registerTool(
  "get_decision",
  { description: "The full DecisionRecord for an applicant: bureau summary, every lender's decision with each reason's verification verdict, the adverse-action notice, human decision and timings.", inputSchema: { applicantId: id } },
  async ({ applicantId }) => run("GET", `/decisions/${encodeURIComponent(applicantId)}`),
);

server.registerTool(
  "get_trace",
  { description: "The audit trail for an applicant. format=text is a plain-English narrative; json is a list of events.", inputSchema: { applicantId: id, format: z.enum(["json", "text"]).default("text") } },
  async ({ applicantId, format }) => run("GET", `/traces/${encodeURIComponent(applicantId)}?format=${format}`),
);

server.registerTool(
  "start_application",
  {
    description: "Start the real underwriting pipeline for a sandbox persona (e.g. P03). Returns immediately with an applicantId; poll list_applicants/get_decision until status is awaiting_human (about 1 minute).",
    inputSchema: { personaId: z.string().describe("Sandbox persona id, P01 to P20"), purpose: z.string(), amountRequested: z.number().positive(), statedIncome: z.number().nonnegative() },
  },
  async (args) => run("POST", "/applications", args),
);

server.registerTool(
  "approve",
  { description: "Record the human approval of one lender's offer. Only call this when a person has told you to; Docket records the actor as human, source api. Fails unless the applicant is awaiting_human and that lender approved.", inputSchema: { applicantId: id, lender: z.enum(["cu", "fintech", "prime", "regional", "subprime"]), note: z.string().optional() } },
  async ({ applicantId, lender, note }) => run("POST", `/decisions/${encodeURIComponent(applicantId)}/approve`, { lender, ...(note ? { note } : {}) }),
);

server.registerTool(
  "decline",
  { description: "Record the human decision to decline the applicant (no offer taken). Only call this when a person has told you to.", inputSchema: { applicantId: id, note: z.string().optional() } },
  async ({ applicantId, note }) => run("POST", `/decisions/${encodeURIComponent(applicantId)}/decline`, { ...(note ? { note } : {}) }),
);

server.registerTool(
  "run_eval",
  {
    description: "Benchmark: run the personas through the real pipeline and score against an answer key. Omit cases for the built-in 20-persona key (takes minutes). Returns agreement, perLenderAgreement, reasonsVerifiedPct, latencyP50Ms and mismatches.",
    inputSchema: {
      cases: z
        .array(
          z.object({
            personaId: z.string(),
            expected: z.enum(["approve", "decline", "hard_stop"]),
            expectedPerLender: z.record(z.enum(["cu", "fintech", "prime", "regional", "subprime"]), z.enum(["approve", "counteroffer", "decline", "none"])).optional(),
          }),
        )
        .optional(),
    },
  },
  async ({ cases }) => run("POST", "/eval", cases ? { cases } : {}),
);

server.registerTool(
  "explain",
  { description: "A four-bullet plain-English summary of an applicant (bureau, each lender and why, what verification withheld, what the human should do next).", inputSchema: { applicantId: id } },
  async ({ applicantId }) => run("GET", `/decisions/${encodeURIComponent(applicantId)}/summary`),
);

await server.connect(new StdioServerTransport());
