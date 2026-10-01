import type { ComparisonRow, EntityResult, Report } from "./types.js";
import type { HeadToHead } from "./agent.js";

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function fmtDate(d?: string): string {
  if (!d) return "—";
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function fmtStars(n?: number): string {
  if (n == null) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** Extractive report — no LLM needed. Every value comes from sourced data. */
export function buildExtractiveReport(
  query: string,
  entities: EntityResult[],
  creditsUsed: number,
  h2h?: HeadToHead
): Report {
  const comparisonTable: ComparisonRow[] = [
    {
      aspect: "Official docs",
      values: entities.map((e) =>
        e.docsUrl ? `${e.docsTitle ?? "Docs"} (${domain(e.docsUrl)})` : "—"
      ),
    },
    {
      aspect: "Latest release",
      values: entities.map((e) =>
        e.latestRelease ? `${e.latestRelease} · ${fmtDate(e.releaseDate)}` : "—"
      ),
    },
    {
      aspect: "GitHub stars",
      values: entities.map((e) => fmtStars(e.stars)),
    },
    {
      aspect: "Maintenance health",
      values: entities.map((e) =>
        e.health ? `${e.health.score}/100 — ${e.health.signals[0] ?? ""}` : "—"
      ),
    },
    {
      aspect: "Last repo activity",
      values: entities.map((e) => fmtDate(e.lastUpdated)),
    },
  ];

  // Composite pick: adoption (log stars) 50% + maintenance health 50%.
  const scored = entities.map((e) => {
    const adoption = e.stars ? Math.min(100, 20 * Math.log10(e.stars + 1)) : 0;
    const health = e.health?.score ?? 50;
    return { e, total: Math.round(adoption * 0.5 + health * 0.5), adoption: Math.round(adoption) };
  });
  scored.sort((a, b) => b.total - a.total);
  const winner = scored[0];

  let verdict: string;
  if (!winner) {
    verdict = "No results found. Try a different query.";
  } else {
    const reasons: string[] = [];
    if (winner.e.stars) reasons.push(`${fmtStars(winner.e.stars)} stars`);
    if (winner.e.health) reasons.push(`maintenance ${winner.e.health.score}/100`);
    if (winner.e.latestRelease) reasons.push(`latest release ${winner.e.latestRelease}`);
    verdict =
      `Based on live data, **${winner.e.name}** looks like the safest bet ` +
      `(${reasons.join(", ") || "limited data"}). `;
    const runnerUp = scored[1];
    if (runnerUp) {
      const diff = winner.total - runnerUp.total;
      verdict +=
        diff >= 15
          ? `It leads **${runnerUp.e.name}** by a clear margin on adoption + maintenance. `
          : `**${runnerUp.e.name}** is close behind — pick by docs quality and API fit for your stack. `;
    }
    if (h2h && h2h.snippets.length > 0) {
      const s = h2h.snippets[0];
      verdict += `Head-to-head chatter: "${s.title}" — see sources for migration notes. `;
    }
    const weak = scored.filter(
      (s) => s.e.health && (s.e.health.archived || s.e.health.score < 35)
    );
    for (const w of weak) {
      verdict += `⚠️ **${w.e.name}** shows maintenance risk (${w.e.health!.signals[0]}). `;
    }
    verdict += "All claims link to live sources below — nothing here is from training data.";
  }

  return {
    query,
    entities,
    comparisonTable,
    verdict,
    creditsUsed,
    generatedAt: new Date().toISOString(),
    mode: "extractive",
  };
}
