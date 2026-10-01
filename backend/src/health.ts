import { ghFetchJson } from "./github.js";
import type { RepoHealth } from "./types.js";

const DAY_MS = 86_400_000;

function daysAgo(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / DAY_MS));
}

function fmtDays(n: number): string {
  if (n < 30) return `${n}d`;
  if (n < 365) return `${Math.round(n / 30)}mo`;
  return `${(n / 365).toFixed(1)}y`;
}

/**
 * Maintenance health for a repo, computed from free GitHub API data
 * (no SerpApi credit). Scores 0–100 from three explainable signals:
 * release recency (40), release cadence (30), open-issue load (30).
 */
export async function repoHealth(fullName: string): Promise<RepoHealth | null> {
  const [repo, releases] = await Promise.all([
    ghFetchJson(`https://api.github.com/repos/${fullName}`) as Promise<Record<string, unknown> | null>,
    ghFetchJson(`https://api.github.com/repos/${fullName}/releases?per_page=10`) as Promise<Array<Record<string, unknown>> | null>,
  ]);
  if (!repo) return null;

  const archived = repo["archived"] === true;
  const openIssues =
    typeof repo["open_issues_count"] === "number" ? (repo["open_issues_count"] as number) : null;
  const lastPushDaysAgo = daysAgo(
    typeof repo["pushed_at"] === "string" ? (repo["pushed_at"] as string) : undefined
  );

  const dates = (Array.isArray(releases) ? releases : [])
    .map((r) => r["published_at"] ?? r["created_at"])
    .filter((d): d is string => typeof d === "string")
    .map((d) => Date.parse(d))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a);

  const daysSinceRelease = dates.length > 0 ? Math.max(0, Math.round((Date.now() - dates[0]) / DAY_MS)) : null;
  let avgReleaseGapDays: number | null = null;
  if (dates.length >= 3) {
    let gap = 0;
    for (let i = 0; i < dates.length - 1; i++) gap += dates[i] - dates[i + 1];
    avgReleaseGapDays = Math.round(gap / (dates.length - 1) / DAY_MS);
  }

  const signals: string[] = [];
  let score: number;

  if (archived) {
    score = 5;
    signals.push("Repository is archived — no future maintenance expected");
  } else {
    // Recency (40)
    let recency: number;
    if (daysSinceRelease == null) { recency = 10; signals.push("No releases published"); }
    else if (daysSinceRelease <= 30) { recency = 40; signals.push(`Released ${fmtDays(daysSinceRelease)} ago`); }
    else if (daysSinceRelease <= 90) { recency = 30; signals.push(`Released ${fmtDays(daysSinceRelease)} ago`); }
    else if (daysSinceRelease <= 180) { recency = 20; signals.push(`Last release ${fmtDays(daysSinceRelease)} ago`); }
    else if (daysSinceRelease <= 365) { recency = 10; signals.push(`Last release ${fmtDays(daysSinceRelease)} ago — slowing down?`); }
    else { recency = 0; signals.push(`No release in ${fmtDays(daysSinceRelease)} — possibly dormant`); }

    // Cadence (30)
    let cadence: number;
    if (avgReleaseGapDays == null) { cadence = 10; }
    else if (avgReleaseGapDays <= 45) { cadence = 30; signals.push(`Ships every ~${avgReleaseGapDays} days`); }
    else if (avgReleaseGapDays <= 120) { cadence = 20; signals.push(`Ships every ~${avgReleaseGapDays} days`); }
    else if (avgReleaseGapDays <= 365) { cadence = 10; signals.push(`Slow cadence (~${fmtDays(avgReleaseGapDays)} between releases)`); }
    else { cadence = 5; signals.push(`Very slow cadence (~${fmtDays(avgReleaseGapDays)} between releases)`); }

    // Issue load (30)
    let issues: number;
    if (openIssues == null) { issues = 10; }
    else if (openIssues < 100) { issues = 30; signals.push(`${openIssues} open issues — healthy`); }
    else if (openIssues < 500) { issues = 22; signals.push(`${openIssues} open issues`); }
    else if (openIssues < 2000) { issues = 14; signals.push(`${openIssues} open issues — heavy backlog`); }
    else { issues = 6; signals.push(`${openIssues.toLocaleString("en-IN")} open issues — heavy backlog`); }

    score = Math.min(100, recency + cadence + issues);
  }

  if (lastPushDaysAgo != null && lastPushDaysAgo > 180 && !archived) {
    signals.push(`No commits in ${fmtDays(lastPushDaysAgo)}`);
  }

  return {
    fullName,
    score,
    daysSinceRelease,
    avgReleaseGapDays,
    openIssues,
    lastPushDaysAgo,
    archived,
    signals,
  };
}
