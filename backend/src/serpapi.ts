import { getJson } from "serpapi";

const MIN_GAP_MS = 1100; // free-tier rate limit ~1 req/sec
let lastCall = 0;
let creditsUsed = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function getCreditsUsed(): number {
  return creditsUsed;
}

export function resetCredits(): void {
  creditsUsed = 0;
}

function apiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    throw new Error(
      "SERPAPI_API_KEY is not set. Add it to your .env file (see .env.example). Get a free key at https://serpapi.com/users/sign_up"
    );
  }
  return key;
}

export interface SerpResult {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
}

export interface SerpResponse {
  results: SerpResult[];
  raw: unknown;
}

/** Throttled SerpApi Google search. 1 call = 1 credit. */
export async function serpSearch(params: {
  q: string;
  engine?: string;
  tbm?: string;
  num?: number;
}): Promise<SerpResponse> {
  const key = apiKey();
  const wait = MIN_GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);

  const json = (await getJson({
    engine: params.engine ?? "google",
    api_key: key,
    q: params.q,
    num: params.num ?? 10,
    ...(params.tbm ? { tbm: params.tbm } : {}),
  } as Record<string, string | number>)) as Record<string, unknown>;

  lastCall = Date.now();
  creditsUsed += 1;

  if (json["error"]) {
    throw new Error(`SerpApi error: ${String(json["error"])}`);
  }

  const organic = (json["organic_results"] ?? json["news_results"] ?? []) as Array<
    Record<string, unknown>
  >;
  const results: SerpResult[] = organic
    .filter((r) => typeof r["link"] === "string")
    .map((r) => ({
      title: String(r["title"] ?? ""),
      link: String(r["link"]),
      snippet: typeof r["snippet"] === "string" ? r["snippet"] : undefined,
      date: typeof r["date"] === "string" ? r["date"] : undefined,
    }));

  return { results, raw: json };
}
