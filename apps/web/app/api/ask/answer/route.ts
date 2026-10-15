import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

type Source = {
  title: string;
  category?: string;
  content: string;
  sourceUrl?: string;
};

export async function POST(request: Request) {
  try {
    const account = await fetchAuthQuery(api.auth.getCurrentUser, {});
    const user = account?.user;
    if (!account?.workspace || !user?.emailVerified) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      question?: string;
      agentName?: string;
      sources?: Source[];
    };

    const question = body.question?.trim();
    const sources = body.sources ?? [];

    if (!question) {
      return NextResponse.json(
        { error: "Question is required." },
        { status: 400 }
      );
    }

    if (sources.length === 0) {
      return NextResponse.json(
        { error: "No verified sources were provided." },
        { status: 400 }
      );
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!convexUrl) {
      return NextResponse.json(
        { error: "Convex URL is not configured." },
        { status: 500 }
      );
    }

    const convex = new ConvexHttpClient(convexUrl);
    const token = await getToken();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    convex.setAuth(token);

    await convex.mutation(api.security.checkRateLimit, {
      key: `user:${user.id}`,
      route: "ask-answer",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    const sourceText = sources
      .map((source, index) =>
        [
          `Source ${index + 1}: ${source.title}`,
          `Category: ${source.category ?? "Uncategorized"}`,
          `Content: ${source.content}`,
        ].join("\n")
      )
      .join("\n\n---\n\n");

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `
You are answering as ${body.agentName ?? "an AI agent"}.

Rules:
- Use only the verified sources below.
- Do not use outside knowledge.
- If the sources do not contain the answer, say that there is not enough verified knowledge.
- Keep the answer concise and useful.
- Include source references using this format: Source: <source title>.

User question:
${question}

Verified sources:
${sourceText}
`,
    });

    return NextResponse.json({
      answer:
        response.text?.trim() ||
        "No answer was generated from the verified sources.",
    });
  } catch (error) {
    console.error("Gemini answer route error:", error);

    // Rate limiting is the one failure the caller can act on, so it keeps a
    // distinct status; everything else stays generic to avoid leaking internals.
    if (error instanceof Error && error.message.includes("Rate limit exceeded")) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate AI answer." },
      { status: 500 }
    );
  }
}
