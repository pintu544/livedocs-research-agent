import { serpSearch } from "./serpapi.js";

const SPLIT_RE = /\s+vs\.?\s+|\s+versus\s+|\s*\|\s*|,/i;

function cleanName(raw: string): string {
  return raw
    .replace(/\s+(docs|documentation|official|github|npm|pypi)$/i, "")
    .replace(/^the\s+/i, "")
    .trim();
}

/**
 * Extract comparison entities from a query.
 * "React Query vs SWR" -> ["React Query", "SWR"]
 * "best node orms" (no separator) -> discovery search for top candidates.
 */
export async function parseEntities(
  query: string,
  onProgress: (step: string, detail?: string) => void
): Promise<string[]> {
  const parts = query
    .split(SPLIT_RE)
    .map((p) => cleanName(p))
    .filter((p) => p.length > 0 && p.length < 60);

  if (parts.length >= 2) {
    return parts.slice(0, 4);
  }

  // Single topic: discover the top contenders with one live search (1 credit).
  onProgress("parse", `Discovering top contenders for "${query}"…`);
  const { results } = await serpSearch({ q: `best ${query} 2026`, num: 10 });
  const seen = new Set<string>();
  const names: string[] = [];
  for (const r of results) {
    const candidate = cleanName(r.title.split(/[-|–—:]/)[0].trim());
    const lower = candidate.toLowerCase();
    if (
      candidate.length >= 2 &&
      candidate.length <= 40 &&
      !seen.has(lower) &&
      !/best|top|guide|tutorial|comparison|review|vs\b/i.test(candidate)
    ) {
      seen.add(lower);
      names.push(candidate);
    }
    if (names.length >= 4) break;
  }
  return names.length >= 2 ? names : parts.length === 1 ? parts : [query.trim()];
}
