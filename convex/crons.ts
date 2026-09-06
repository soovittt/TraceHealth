import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Keep every connected provider fresh: refresh tokens + re-sync every 2 hours.
crons.interval("auto-sync connections", { hours: 2 }, internal.fhir.syncAllConnections, {});

export default crons;
