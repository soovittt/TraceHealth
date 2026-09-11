import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Keep every connected provider fresh: refresh tokens + re-sync every 2 hours.
crons.interval("auto-sync connections", { hours: 2 }, internal.fhir.syncAllConnections, {});

// Scheduled reports: scan report schedules every 6 hours and generate any that
// are due (cadence gating in dueSchedules keeps daily/weekly/monthly/yearly honest).
crons.interval("scheduled reports", { hours: 6 }, internal.reports.runDueReportSchedules, {});

export default crons;
