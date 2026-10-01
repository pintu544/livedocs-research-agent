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
 * Research one entity: official docs, release notes, news, GitHub stats.
 * Costs ~3 SerpApi credits. Emits progress via the callback.
 */
export async function researchEntity(
  name: string,
  onProgress: (step: string, detail?: string) => void
): Promise<EntityResult> {
  const entity: EntityResult = { name, sources: [] };

  // 1. Official docs (1 credit)
  try {
    onProgress("search", `Finding official docs for ${name}…`);
    const { results } = await serpSearch({ q: `${name} official documentation`, num: 10 });
    const docs = results.find((r) => {
      const d = (domainOf(r.link) ?? "").toLowerCase();
      return (
        !/github\.com|npmjs\.com|stackoverflow|medium\.com|youtube\.com/.test(d) ||
        /docs\.|documentation/i.test(r.title)
      );
    });
    const top = docs ?? results[0];
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

  // 2. Release notes via GitHub releases search (1 credit)
  try {
    onProgress("search", `Checking release notes for ${name}…`);
    const { results } = await serpSearch({ q: `site:github.com ${name} releases`, num: 5 });
    const rel = results[0];
    if (rel) {
      entity.sources.push(toSource(rel, "release"));
      const m = rel.title.match(/v?\d+\.\d+(\.\d+)?/);
      if (m) entity.latestRelease = m[0];
      if (rel.date) entity.releaseDate = rel.date;
    }
  } catch (e) {
    onProgress("search", `Release search for ${name} failed: ${(e as Error).message}`);
  }

  // 3. News / announcements (1 credit)
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

  // 4. GitHub stats (free — no SerpApi credit)
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

  if (!entity.summary) {
    const first = entity.sources.find((s) => s.snippet);
    entity.summary = first?.snippet?.slice(0, 400);
  }

  return entity;
}
