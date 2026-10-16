import { api } from "../../../../../../convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const account = await fetchAuthQuery(api.auth.getCurrentUser, {});
    if (!account?.workspace) return Response.json({ error: "Sign in and select a workspace." }, { status: 401, headers });
    const response = await fetch("https://ai-gateway.vercel.sh/v1/models", { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) throw new Error();
    const payload = await response.json() as { data?: { id: string }[] };
    const listed = payload.data?.some(model => model.id === "openai/gpt-live-1.1") === true;
    return Response.json({ available: false, requestedModel: "GPT-Live 1.1", reason: listed ? "The requested model is listed, but its audio protocol, account access and cleanup journey have not yet been verified. Voice remains disabled until that release gate passes." : "AI Gateway does not currently list GPT-Live 1.1. Voice cannot start, and your microphone has not been accessed. Text assistance remains available. No older model is substituted." }, { headers });
  } catch { return Response.json({ available: false, reason: "Voice availability could not be verified. Your microphone has not been accessed. Try again later or use text." }, { status: 503, headers }); }
}
