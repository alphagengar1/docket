import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Nightly eval at 02:00 Pacific (09:00 UTC during PDT).
crons.daily("nightly eval", { hourUTC: 9, minuteUTC: 0 }, internal.eval.runEvalInternal, {});

export default crons;
