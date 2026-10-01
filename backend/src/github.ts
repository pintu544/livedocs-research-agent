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

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "LiveDocs-Research-Agent/1.0",
    Accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/** Shared GitHub API GET with one retry on rate-limit / transient errors. Exported for health.ts. */
export async function ghFetchJson(url: string, retries = 1): Promise<unknown | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, { headers: githubHeaders(), signal: ctrl.signal });
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

function semanticVersion(tag: string): string | null {
  const match = tag.match(/(?:^|[^0-9])(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:$|[^0-9])/);
  return match ? `v${match[1]}` : null;
}

/** Latest stable semantic release for a repo, or null if none / not found. */
export async function latestRelease(
  fullName: string,
  entityName?: string
): Promise<GithubReleaseInfo | null> {
  const data = (await ghFetchJson(
    `https://api.github.com/repos/${fullName}/releases?per_page=100`
  )) as Array<Record<string, unknown>> | null;
  if (!Array.isArray(data)) return null;

  const stable = data.filter(
    (release) =>
      release["draft"] !== true &&
      release["prerelease"] !== true &&
      typeof release["tag_name"] === "string" &&
      semanticVersion(String(release["tag_name"])) !== null
  );
  const tokens = (entityName ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
  const packageSpecific = stable.find((release) => {
    const tag = String(release["tag_name"]).toLowerCase();
    return tokens.length > 0 && tokens.every((token) => tag.includes(token));
  });
  const release = packageSpecific ?? stable[0];
  if (!release) return null;
  const version = semanticVersion(String(release["tag_name"]));
  if (!version) return null;
  return {
    tag: version,
    name: typeof release["name"] === "string" ? release["name"] : undefined,
    publishedAt:
      typeof release["published_at"] === "string" ? String(release["published_at"]) : undefined,
    url: typeof release["html_url"] === "string" ? String(release["html_url"]) : "",
  };
}
