import type { EntityResult, Report } from "./types.js";
import { buildExtractiveReport } from "./extractive.js";

const SYSTEM_PROMPT = `You are a precise technical research assistant. Given live-fetched data about libraries/tools, produce a JSON comparison report. Rules:
- Every factual claim MUST cite a source URL from the provided sources (add a "sources" array per entity using the exact URLs given).
- Never invent version numbers, dates, or stats — use only the data provided. If a field is missing, use null.
- Keep summaries to 2 sentences, verdict to 3 sentences max.
- Output ONLY valid JSON matching this schema:
{
  "entities": [
    { "name": string, "docsUrl": string|null, "latestRelease": string|null,
      "releaseDate": string|null, "stars": number|null, "repoUrl": string|null,
      "summary": string, "sources": [{ "title": string, "url": string, "kind": string }] }
  ],
  "comparisonTable": [ { "aspect": string, "values": [string, ...] } ],
  "verdict": string
}`;

/** Optional LLM synthesis via any OpenAI-compatible endpoint. Returns null on any failure. */
export async function synthesizeWithLlm(
  query: string,
  entities: EntityResult[],
  creditsUsed: number
): Promise<Report | null> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) return null;

  const payload = entities.map((e) => ({
    name: e.name,
    docsUrl: e.docsUrl ?? null,
    docsTitle: e.docsTitle ?? null,
    latestRelease: e.latestRelease ?? null,
    releaseDate: e.releaseDate ?? null,
    stars: e.stars ?? null,
    repoUrl: e.repoUrl ?? null,
    lastUpdated: e.lastUpdated ?? null,
    summary: e.summary ?? null,
    sources: e.sources.map((s) => ({ title: s.title, url: s.url, kind: s.kind })),
  }));

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `User query: "${query}"\n\nLive data:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Partial<Report>;
    if (!Array.isArray(parsed.entities) || typeof parsed.verdict !== "string") return null;

    return {
      query,
      entities: parsed.entities as Report["entities"],
      comparisonTable: Array.isArray(parsed.comparisonTable) ? parsed.comparisonTable : [],
      verdict: parsed.verdict,
      creditsUsed,
      generatedAt: new Date().toISOString(),
      mode: "llm",
    };
  } catch {
    return null;
  }
}

/** Synthesize with LLM when configured, otherwise extractive fallback. */
export async function synthesize(
  query: string,
  entities: EntityResult[],
  creditsUsed: number
): Promise<Report> {
  const llm = await synthesizeWithLlm(query, entities, creditsUsed);
  return llm ?? buildExtractiveReport(query, entities, creditsUsed);
}
