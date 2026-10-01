import { parseEntities } from "./parse.js";
import { researchEntity } from "./research.js";
import { repoHealth } from "./health.js";
import { serpSearch, getCreditsUsed, resetCredits } from "./serpapi.js";
import { synthesize } from "./synthesize.js";
import type { Report } from "./types.js";

export interface HeadToHead {
  a: string;
  b: string;
  snippets: { title: string; url: string; snippet?: string }[];
}

/**
 * The agent loop: plan → research in parallel → reflect on gaps and run
 * targeted follow-ups → head-to-head deep dive → maintenance health scoring
 * → synthesize. Every decision is narrated via "thought" progress events so
 * the UI can show the agent's reasoning live.
 */
export async function runAgent(
  query: string,
  onProgress: (step: string, detail?: string) => void
): Promise<Report> {
  resetCredits();
  onProgress("thought", `Breaking down your query: "${query}"…`);

  const names = await parseEntities(query, onProgress);
  if (names.length === 0) throw new Error("Could not extract anything to compare from the query.");
  onProgress("thought", `Plan: research ${names.length} contenders in parallel — ${names.join(" · ")} — then dig into gaps and run a head-to-head.`);

  const progress = (step: string, detail?: string) => onProgress(step, detail);
  const entities = await Promise.all(names.map((n) => researchEntity(n, progress)));

  // Reflect: fill gaps with targeted follow-ups (max 1 extra search per entity).
  for (const e of entities) {
    if (!e.docsUrl) {
      onProgress("thought", `${e.name} has no docs link yet — searching specifically for its documentation site…`);
      try {
        const { results } = await serpSearch({ q: `${e.name} documentation site`, num: 5 });
        const top = results[0];
        if (top) {
          e.docsUrl = top.link;
          e.docsTitle = top.title;
          e.sources.push({ title: top.title, url: top.link, snippet: top.snippet, kind: "docs" });
          onProgress("thought", `Found docs for ${e.name}: ${top.link}`);
        }
      } catch {
        onProgress("thought", `Docs follow-up for ${e.name} came up empty — moving on.`);
      }
    } else if (!e.latestRelease) {
      onProgress("thought", `${e.name} is missing release info — checking its changelog…`);
      try {
        const { results } = await serpSearch({ q: `${e.name} changelog latest release version`, num: 5 });
        const rel = results[0];
        if (rel) {
          const m = `${rel.title} ${rel.snippet ?? ""}`.match(/v?\d+\.\d+(\.\d+)?/);
          if (m) {
            e.latestRelease = m[0];
            onProgress("thought", `Spotted ${e.name} ${m[0]} in the changelog results.`);
          }
          e.sources.push({ title: rel.title, url: rel.link, snippet: rel.snippet, kind: "release" });
        }
      } catch {
        onProgress("thought", `Changelog follow-up for ${e.name} came up empty — moving on.`);
      }
    }
  }

  // Head-to-head deep dive between the two most-starred contenders.
  let h2h: HeadToHead | undefined;
  const ranked = [...entities].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
  if (ranked.length >= 2 && (ranked[0].stars ?? 0) > 0) {
    const [a, b] = ranked;
    onProgress("thought", `Running a head-to-head deep dive: ${a.name} vs ${b.name} — migration stories, trade-offs, what people complain about…`);
    try {
      const { results } = await serpSearch({ q: `${a.name} vs ${b.name} comparison migrate`, num: 8 });
      const snippets = results.slice(0, 4).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }));
      if (snippets.length > 0) {
        h2h = { a: a.name, b: b.name, snippets };
        for (const r of results.slice(0, 4)) {
          a.sources.push({ title: r.title, url: r.link, snippet: r.snippet, kind: "page" });
        }
        onProgress("thought", `Head-to-head surfaced ${snippets.length} comparison sources.`);
      }
    } catch {
      onProgress("thought", "Head-to-head search failed — the individual reports still stand on their own.");
    }
  }

  // Maintenance health (free GitHub data, no SerpApi credit).
  onProgress("thought", "Scoring maintenance health — release cadence, recency, issue backlog…");
  await Promise.all(
    entities.map(async (e) => {
      const full = e.repoUrl?.match(/github\.com\/([^/]+\/[^/]+)/)?.[1];
      if (!full) return;
      try {
        const h = await repoHealth(full);
        if (h) {
          e.health = h;
          onProgress("thought", `${e.name}: maintenance score ${h.score}/100 — ${h.signals[0] ?? "no signals"}.`);
        }
      } catch {
        /* health is best-effort */
      }
    })
  );

  onProgress("thought", "Weighing adoption, maintenance health, and docs against each other…");
  return synthesize(query, entities, getCreditsUsed(), h2h);
}
