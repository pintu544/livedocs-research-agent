import type { ComparisonRow, EntityResult, Report } from "./types.js";

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
  creditsUsed: number
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
      aspect: "Last repo activity",
      values: entities.map((e) => fmtDate(e.lastUpdated)),
    },
  ];

  const ranked = [...entities].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
  const top = ranked[0];
  const verdict =
    entities.length === 0
      ? "No results found. Try a different query."
      : `Based on live data: **${top.name}** leads on community adoption (${fmtStars(
          top.stars
        )} stars${
          top.latestRelease ? `, latest release ${top.latestRelease}` : ""
        }). ` +
        `Pick the one whose docs and release cadence best match your stack — all sources below are from the last live search, not training data.`;

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
