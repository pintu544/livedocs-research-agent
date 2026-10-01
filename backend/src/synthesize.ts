import type { ComparisonRow, EntityResult, Report } from "./types.js";
import type { HeadToHead } from "./agent.js";
import { buildExtractiveReport } from "./extractive.js";

const SYSTEM_PROMPT = `You are a precise technical research assistant. Given live-fetched data about libraries/tools, produce a JSON comparison report. Rules:
- Every factual claim MUST cite a source URL from the provided sources (add a "sources" array per entity using the exact URLs given).
- Never invent version numbers, dates, or stats — use only the data provided. If a field is missing, use null.
- Each entity carries a "health" object with a 0-100 maintenance score and signals — weigh it in the verdict and include a "Maintenance health" row in the comparisonTable with values like "92/100 — Released 3d ago" (score + first signal).
- If head-to-head context is provided, add a "Head-to-head" row to the comparisonTable summarizing migration/trade-off notes, and fold one sentence about it into the verdict.
- Keep summaries to 2 sentences, verdict to 4 sentences max.
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

/**
 * Optional LLM synthesis via any OpenAI-compatible endpoint.
 * Throws a descriptive Error on any failure (never returns null silently)
 * so the caller can surface loud fallback telemetry. Never includes secrets
 * in error messages.
 */
export async function synthesizeWithLlm(
  query: string,
  entities: EntityResult[],
  creditsUsed: number,
  h2h?: HeadToHead
): Promise<Report> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) throw new Error("LLM_API_KEY is not set");

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
    health: e.health
      ? {
          score: e.health.score,
          signals: e.health.signals,
          daysSinceRelease: e.health.daysSinceRelease,
          openIssues: e.health.openIssues,
          archived: e.health.archived,
        }
      : null,
    sources: e.sources.map((s) => ({
      title: s.title,
      url: s.url,
      kind: s.kind,
      snippet: s.snippet ?? null,
      date: s.date ?? null,
    })),
  }));

  const h2hBlock = h2h
    ? `\n\nHead-to-head context (${h2h.a} vs ${h2h.b}):\n${h2h.snippets
        .map((s) => `- ${s.title} (${s.url}): ${s.snippet ?? ""}`)
        .join("\n")}`
    : "";

  let res: Response;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
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
              content: `User query: "${query}"\n\nLive data:\n${JSON.stringify(payload, null, 2)}${h2hBlock}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  } catch (err) {
    throw new Error(
      err instanceof Error && err.name === "AbortError"
        ? "LLM request timed out after 60s"
        : `LLM request failed: ${err instanceof Error ? err.message : "network error"}`
    );
  }
  if (!res.ok) {
    throw new Error(`LLM API returned HTTP ${res.status} ${res.statusText}`.trim());
  }
  let parsed: Partial<Report>;
  try {
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty response content");
    parsed = JSON.parse(content) as Partial<Report>;
  } catch (err) {
    throw new Error(
      `LLM returned unusable response: ${err instanceof Error ? err.message : "parse error"}`
    );
  }
  if (
    !Array.isArray(parsed.entities) ||
    typeof parsed.verdict !== "string" ||
    !parsed.verdict.trim()
  ) {
    throw new Error("LLM response failed schema validation (entities/verdict missing)");
  }

  // The model can improve prose, but cannot replace measured fields or the
  // source ledger. Merge only bounded summaries into authoritative entities.
  const modelEntities = parsed.entities as Array<{ name?: string; summary?: string }>;
  const safeEntities = entities.map((entity) => {
    const generated = modelEntities.find(
      (candidate) => candidate.name?.toLowerCase() === entity.name.toLowerCase()
    );
    return {
      ...entity,
      summary:
        typeof generated?.summary === "string" && generated.summary.trim()
          ? generated.summary.trim().slice(0, 800)
          : entity.summary,
    };
  });

  // Numeric/factual rows remain deterministic. Allow only a small number of
  // structurally valid qualitative rows from the model; malformed JSON can
  // never crash the React table or Markdown export.
  const baseline = buildExtractiveReport(query, entities, creditsUsed, h2h);
  const qualitativeRows: ComparisonRow[] = Array.isArray(parsed.comparisonTable)
    ? parsed.comparisonTable
        .filter((row): row is ComparisonRow =>
          Boolean(
            row &&
              typeof row.aspect === "string" &&
              /head-to-head|trade-?offs?|migration|best for|use case/i.test(row.aspect) &&
              Array.isArray(row.values) &&
              row.values.length === entities.length &&
              row.values.every((value) => typeof value === "string")
          )
        )
        .slice(0, 2)
    : [];

  return {
    query,
    entities: safeEntities,
    comparisonTable: [...baseline.comparisonTable, ...qualitativeRows],
    verdict: parsed.verdict.trim().slice(0, 2000),
    creditsUsed,
    generatedAt: new Date().toISOString(),
    mode: "llm",
  };
}

/** Synthesize with LLM when configured, otherwise extractive fallback. */
export async function synthesize(
  query: string,
  entities: EntityResult[],
  creditsUsed: number,
  h2h?: HeadToHead,
  onProgress?: (step: string, detail?: string) => void
): Promise<Report> {
  try {
    return await synthesizeWithLlm(query, entities, creditsUsed, h2h);
  } catch (err) {
    // Loud fallback: the reasoning trace (and SSE stream) must show that the
    // LLM path failed and why, instead of silently switching modes.
    const reason = err instanceof Error ? err.message : "unknown error";
    onProgress?.(
      "thought",
      `⚠️ LLM synthesis failed (${reason}) — falling back to extractive mode.`
    );
    return buildExtractiveReport(query, entities, creditsUsed, h2h);
  }
}
