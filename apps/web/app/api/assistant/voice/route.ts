import { api } from "../../../../../../convex/_generated/api";
import { isTrustedRequestOrigin } from "@/lib/trusted-request-origin";
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
    const payload = await response.json() as { data?: unknown[] };
    if (!Array.isArray(payload.data)) throw new Error();
    const model = payload.data.find((value): value is { id: string; pricing?: { realtime_session_duration_cost_per_second?: unknown } } =>
      typeof value === "object" && value !== null && "id" in value && value.id === LIVE_MODEL);
    const listed = Boolean(model);
    const price = model?.pricing?.realtime_session_duration_cost_per_second;
    const durationPriced = (typeof price === "string" && price.trim() !== "" || typeof price === "number")
      && Number.isFinite(Number(price)) && Number(price) >= 0;
    return Response.json({ available: false, model: LIVE_MODEL, requestedModel: "GPT-Live 1.1", transport: "native-live-websocket",
      gate: !listed ? "exact-model-unavailable" : !durationPriced ? "duration-pricing-unavailable" : "native-live-credentials",
      reason: listed && !durationPriced
        ? "The exact voice model has no verifiable duration pricing. Voice remains disabled; no token or microphone access is attempted."
        : listed
        ? "The exact requested model and duration pricing are listed, but authenticated native Live token issuance and microphone/playback acceptance have not been verified for this deployment. Voice remains disabled. No alternative credential or model is used."
        : "AI Gateway does not currently list openai/gpt-live-1.1. Native transport code is implemented but voice cannot start. Your microphone has not been accessed. Text remains available; no other model is substituted." }, { headers });
  } catch { return Response.json({ available: false, model: LIVE_MODEL, gate: "availability-check-failed", reason: "Voice availability could not be verified. Your microphone has not been accessed. Try again later or use text." }, { status: 503, headers }); }
}
export async function GET() { return availability(); }
export async function POST(request: Request) {
  if (!isTrustedRequestOrigin(request)) return Response.json({ error: "Request origin is not allowed" }, { status: 403, headers });
  const response = await availability();
  if (response.status !== 200) return response;
  return Response.json(await response.json(), { status: 503, headers });
}
