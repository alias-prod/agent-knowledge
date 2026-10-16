import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval("Expire assistant history and proposals", { minutes: 15 }, internal.assistantOperations.cleanupExpired);
export default crons;
