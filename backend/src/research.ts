import { serpSearch } from "./serpapi.js";
import { findRepo, latestRelease } from "./github.js";
import type { EntityResult, Source } from "./types.js";

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function wordHits(hay: string, words: string[]): number {
  let n = 0;
  for (const w of words) {
    if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(hay)) n++;
  }
  return n;
}

/**
 * Rank a docs-search candidate: prefer pages whose title/domain actually
 * mentions the entity (word boundaries, so "React Query" doesn't match
 * "React QueryBuilder"), prefer docs-like pages, penalize aggregators.
 */
function scoreDocCandidate(
  name: string,
  title: string,
  link: string
): number {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
  if (words.length === 0) return 0;
  const t = title.toLowerCase();
  const d = (domainOf(link) ?? "").toLowerCase();
  const hay = `${t} ${d}`;

  let score = wordHits(hay, words) * 2;
  if (wordHits(hay, [name.toLowerCase()]) > 0 && words.length > 1) score += 3;
  if (/docs\.|documentation|\/docs(\/|$)/.test(hay)) score += 2;
  if (/github\.com|npmjs\.com|stackoverflow\.com|medium\.com|youtube\.com|dev\.to|reddit\.com|quora\.com/.test(d))
    score -= 4;
  if (wordHits(hay, words) === 0) score -= 10;
  return score;
}

function toSource(
  r: { title: string; link: string; snippet?: string; date?: string },
  kind: Source["kind"]
): Source {
  return { title: r.title, url: r.link, snippet: r.snippet, date: r.date, kind };
}

/** Best-effort plain-text fetch of a docs page (no SerpApi credit). */
async function fetchPageText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": "LiveDocs-Research-Agent/1.0" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain/.test(ct)) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 200 ? text.slice(0, 4000) : null;
  } catch {
    return null;
  }
}

/**
 * Research one entity: GitHub stats + homepage docs, release notes, news.
 * Costs ~2 SerpApi credits (docs search skipped when the repo homepage
 * gives us the official docs URL). Emits progress via the callback.
 */
export async function researchEntity(
  name: string,
  onProgress: (step: string, detail?: string) => void
): Promise<EntityResult> {
  const entity: EntityResult = { name, sources: [] };

  // 1. GitHub stats first (free — no SerpApi credit). The repo homepage is
  //    usually the official docs site, which beats any search ranking.
  try {
    onProgress("github", `Fetching GitHub stats for ${name}…`);
    const repo = await findRepo(name);
    if (repo) {
      entity.repoUrl = repo.htmlUrl;
      entity.stars = repo.stars;
      entity.lastUpdated = repo.updatedAt;
      entity.sources.push({
        title: `${repo.fullName} on GitHub`,
        url: repo.htmlUrl,
        snippet: repo.description,
        kind: "repo",
      });
      if (repo.homepage && domainOf(repo.homepage) !== "github.com") {
        entity.docsUrl = repo.homepage;
        entity.docsTitle = `${name} — official docs`;
        entity.sources.push({
          title: `${name} — official docs`,
          url: repo.homepage,
          kind: "docs",
        });
        const pageText = await fetchPageText(repo.homepage);
        if (pageText) {
          const sentences = pageText.match(/[^.!?]+[.!?]/g) ?? [];
          entity.summary = sentences.slice(0, 3).join(" ").slice(0, 600) || undefined;
        }
      }
      const rel = await latestRelease(repo.fullName);
      if (rel) {
        if (!entity.latestRelease) entity.latestRelease = rel.tag;
        if (!entity.releaseDate && rel.publishedAt) entity.releaseDate = rel.publishedAt;
        entity.sources.push({
          title: `Release ${rel.tag} — ${repo.fullName}`,
          url: rel.url,
          date: rel.publishedAt,
          kind: "release",
        });
      }
    }
  } catch (e) {
    onProgress("github", `GitHub lookup for ${name} failed: ${(e as Error).message}`);
  }

  // 2. Official docs via search (1 credit) — only if the repo homepage
  //    didn't already give us the docs URL.
  if (!entity.docsUrl) {
    try {
      onProgress("search", `Finding official docs for ${name}…`);
      const { results } = await serpSearch({ q: `${name} official documentation`, num: 10 });
      const ranked = [...results]
        .map((r) => ({ r, score: scoreDocCandidate(name, r.title, r.link) }))
        .sort((a, b) => b.score - a.score);
      const top = (ranked[0]?.score ?? -Infinity) > -10 ? ranked[0].r : results[0];
      if (top) {
        entity.docsUrl = top.link;
        entity.docsTitle = top.title;
        entity.sources.push(toSource(top, "docs"));
        for (const r of results.slice(0, 4)) {
          if (r.link !== top.link) entity.sources.push(toSource(r, "page"));
        }
        // Best-effort deep read of the docs page for the summary.
        const pageText = await fetchPageText(top.link);
        if (pageText) {
          const sentences = pageText.match(/[^.!?]+[.!?]/g) ?? [];
          entity.summary = sentences.slice(0, 3).join(" ").slice(0, 600) || undefined;
        }
      }
    } catch (e) {
      onProgress("search", `Docs search for ${name} failed: ${(e as Error).message}`);
    }
  }

  // 3. Release notes via GitHub releases search (1 credit)
  try {
    onProgress("search", `Checking release notes for ${name}…`);
    const { results } = await serpSearch({ q: `site:github.com ${name} releases`, num: 5 });
    const rel = results[0];
    if (rel) {
      entity.sources.push(toSource(rel, "release"));
      const m = rel.title.match(/v?\d+\.\d+(\.\d+)?/);
      if (m && !entity.latestRelease) entity.latestRelease = m[0];
      if (rel.date && !entity.releaseDate) entity.releaseDate = rel.date;
    }
  } catch (e) {
    onProgress("search", `Release search for ${name} failed: ${(e as Error).message}`);
  }

  // 4. News / announcements (1 credit)
  try {
    onProgress("search", `Scanning latest news for ${name}…`);
    const { results } = await serpSearch({
      q: `${name} release OR launch OR update`,
      tbm: "nws",
      num: 5,
    });
    for (const r of results.slice(0, 3)) entity.sources.push(toSource(r, "news"));
  } catch (e) {
    onProgress("search", `News search for ${name} failed: ${(e as Error).message}`);
  }

  if (!entity.summary) {
    const first = entity.sources.find((s) => s.snippet);
    entity.summary = first?.snippet?.slice(0, 400);
  }

  return entity;
}
