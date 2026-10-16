import { api } from "../../../../../../convex/_generated/api";
import { getAuthEnvironment } from "../../../../../../convex/authEnvironment";
import { fetchAuthQuery } from "@/lib/auth-server";
import { LIVE_MODEL } from "@/lib/assistant/live-session";

const headers = { "Cache-Control": "no-store" };
async function availability() {
  try {
    const account = await fetchAuthQuery(api.auth.getCurrentUser, {});
    if (!account?.workspace || !account.user?.emailVerified) return Response.json({ error: "Sign in with a verified account and select a workspace." }, { status: 401, headers });
  } catch { return Response.json({ error: "Sign in again to use voice." }, { status: 401, headers }); }
  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/models", { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) throw new Error();
    const payload = await response.json() as { data?: { id: string }[] };
    if (!Array.isArray(payload.data)) throw new Error();
    const listed = payload.data.some(model => model.id === LIVE_MODEL);
    return Response.json({ available: false, model: LIVE_MODEL, requestedModel: "GPT-Live 1.1", transport: "native-live-websocket",
      gate: listed ? "native-live-credentials" : "exact-model-unavailable",
      reason: listed
        ? "The exact requested model is listed. Native transport code is implemented, but this installed Gateway SDK has no Live-aware token helper using managed authentication. Voice remains disabled; account access and microphone/playback acceptance are unverified. No alternative credential or model is used."
        : "AI Gateway does not currently list openai/gpt-live-1.1. Native transport code is implemented but voice cannot start. Your microphone has not been accessed. Text remains available; no other model is substituted." }, { headers });
  } catch { return Response.json({ available: false, model: LIVE_MODEL, gate: "availability-check-failed", reason: "Voice availability could not be verified. Your microphone has not been accessed. Try again later or use text." }, { status: 503, headers }); }
}
export async function GET() { return availability(); }
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !getAuthEnvironment(process.env).trustedOrigins.includes(origin)) return Response.json({ error: "Request origin is not allowed" }, { status: 403, headers });
  const response = await availability();
  if (response.status !== 200) return response;
  return Response.json(await response.json(), { status: 503, headers });
}
