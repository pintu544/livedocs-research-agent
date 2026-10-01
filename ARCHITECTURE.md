# LiveDocs Research Agent — Architecture

SerpApi India Hackathon 2026 · Track: AI Agents · Solo entry by Pintu Kumar
Deadline: October 10, 2026, 11:59 PM IST

## What it is
An AI research assistant that compares libraries/tools using **live** documentation,
release announcements, and community signals — every claim backed by a sourced link.
User asks "React Query vs SWR" (or "best Node.js ORMs") and gets a comparison report
built from data fetched seconds ago via SerpApi, not from stale training knowledge.

## Stack
- Backend: Node.js 20 + TypeScript + Express
- Frontend: React 18 + Vite + TypeScript, Tailwind CSS
- Search: `serpapi` npm package (official), direct REST calls — no MCP, no Python
- LLM (optional): any OpenAI-compatible endpoint via `LLM_BASE_URL` + `LLM_API_KEY`.
  Without a key the app falls back to an extractive report built from snippets.
- No database. History lives in the browser (localStorage).

## Agent pipeline (backend, `POST /api/research`, SSE progress stream)
1. **Parse** — extract entities from the query. Heuristic: split on "vs"/"versus"/commas;
   single topic → treat as "best X for Y" discovery.
2. **Search (SerpApi, ~4–6 credits per run, ≥1s between calls)** per entity:
   - Official docs: `engine=google, q="site:<likely-docs-domain> <entity>"` — first
     try `q="<entity> official documentation"`, take top result's domain for refinement.
   - Release notes: `q="site:github.com <entity> releases"` → latest release + date.
   - News/announcements: `engine=google, tbm=nws, q="<entity> release OR launch"`.
   - GitHub stats: unauthenticated api.github.com search for stars/updated_at
     (free, costs no SerpApi credits).
3. **Fetch** — top 2–3 docs pages per entity via SerpApi `getMarkdown` (token-cheap)
   or direct fetch fallback.
4. **Synthesize** — if `LLM_API_KEY` set: structured prompt → JSON report with
   citations. Else: extractive report from titles/snippets/dates (still sourced).
5. **Report JSON** — `{ entities: [{name, docsUrl, latestRelease, releaseDate, stars,
   summary, sources[]}], comparisonTable: [{aspect, values[]}], verdict, creditsUsed }`.
   Every factual claim carries a source link.

## Frontend pages
- Home: query input + example chips ("React Query vs SWR", "Zustand vs Redux"),
  live pipeline progress (SSE steps), report view.
- Report: entity cards (docs link, latest release, stars), comparison table,
  verdict, collapsible source list with links, "Export Markdown" button.
- History: past reports from localStorage, re-open offline.

## Robustness / hackathon rules
- `SERPAPI_API_KEY` from env only; never committed. `.env.example` provided.
- Graceful degradation: SerpApi error → clear message + credits note;
  no LLM key → extractive mode banner.
- README documents: setup, env vars, how SerpApi is used (required by judges),
  credit budget (~5/run), demo video script outline.
