import { getJson } from "serpapi";
import { AsyncLocalStorage } from "node:async_hooks";

const MIN_GAP_MS = 1100; // free-tier rate limit ~1 req/sec
const SEARCH_TIMEOUT_MS = 25_000;
let lastCall = 0;
let searchQueue: Promise<void> = Promise.resolve();
const creditContext = new AsyncLocalStorage<{ credits: number }>();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function getCreditsUsed(): number {
  return creditContext.getStore()?.credits ?? 0;
}

/** Isolates credit accounting for one research run, even when requests overlap. */
export function withSearchSession<T>(fn: () => Promise<T>): Promise<T> {
  return creditContext.run({ credits: 0 }, fn);
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
  // SerpApi's free tier is rate-limited globally, not per entity/request. A
  // promise queue preserves parallel entity research while serializing only
  // the paid search calls.
  const previous = searchQueue;
  let release!: () => void;
  searchQueue = new Promise<void>((resolve) => { release = resolve; });

  await previous;
  let json: Record<string, unknown>;
  try {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    // A submitted search consumes a credit even if SerpApi returns an error.
    const context = creditContext.getStore();
    if (context) context.credits += 1;
    json = (await getJson({
      engine: params.engine ?? "google",
      api_key: key,
      q: params.q,
      num: params.num ?? 10,
      timeout: SEARCH_TIMEOUT_MS,
      ...(params.tbm ? { tbm: params.tbm } : {}),
    } as Record<string, string | number>)) as Record<string, unknown>;
  } finally {
    lastCall = Date.now();
    release();
  }

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
