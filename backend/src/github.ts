export interface GithubRepoInfo {
  fullName: string;
  htmlUrl: string;
  stars: number;
  updatedAt?: string;
  description?: string;
  homepage?: string;
}

export interface GithubReleaseInfo {
  tag: string;
  name?: string;
  publishedAt?: string;
  url: string;
}

const HEADERS = {
  "User-Agent": "LiveDocs-Research-Agent/1.0",
  Accept: "application/vnd.github+json",
};

/** Shared GitHub API GET with one retry on rate-limit / transient errors. Exported for health.ts. */
export async function ghFetchJson(url: string, retries = 1): Promise<unknown | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return (await res.json()) as unknown;
      // Retry once on rate-limit / transient server errors.
      if (attempt < retries && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return null;
    } catch {
      if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}

/** Best-effort GitHub repo lookup. Free, costs no SerpApi credits. */
export async function findRepo(query: string): Promise<GithubRepoInfo | null> {
  const data = (await ghFetchJson(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(
      query
    )}&per_page=1&sort=stars&order=desc`
  )) as { items?: Array<Record<string, unknown>> } | null;
  const item = data?.items?.[0];
  if (!item) return null;
  const homepage =
    typeof item["homepage"] === "string" && /^https?:\/\//.test(item["homepage"])
      ? String(item["homepage"])
      : undefined;
  return {
    fullName: String(item["full_name"]),
    htmlUrl: String(item["html_url"]),
    stars: Number(item["stargazers_count"] ?? 0),
    updatedAt:
      typeof item["updated_at"] === "string" ? String(item["updated_at"]) : undefined,
    description:
      typeof item["description"] === "string" ? String(item["description"]) : undefined,
    homepage,
  };
}

/** Latest published release for a repo, or null if none / not found. */
export async function latestRelease(fullName: string): Promise<GithubReleaseInfo | null> {
  const data = (await ghFetchJson(
    `https://api.github.com/repos/${fullName}/releases/latest`
  )) as Record<string, unknown> | null;
  if (!data || typeof data["tag_name"] !== "string") return null;
  return {
    tag: String(data["tag_name"]),
    name: typeof data["name"] === "string" ? data["name"] : undefined,
    publishedAt:
      typeof data["published_at"] === "string" ? String(data["published_at"]) : undefined,
    url: typeof data["html_url"] === "string" ? String(data["html_url"]) : "",
  };
}
