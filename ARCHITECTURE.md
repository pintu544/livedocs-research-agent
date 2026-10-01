# LiveDocs Research Agent — Architecture

SerpApi India Hackathon 2026 · Track: AI Agents · Solo entry by Pintu Kumar
Deadline: October 10, 2026, 11:59 PM IST

## What it is
An AI research assistant that compares libraries/tools using **live** documentation,
release announcements, and community signals — with an inspectable evidence ledger.
User asks "React Query vs SWR" (or "best Node.js ORMs") and gets a comparison report
built from data fetched seconds ago via SerpApi, not from stale training knowledge.

## Stack
- Backend: Node.js 20 + TypeScript + Express
- Frontend: React 18 + Vite + TypeScript, Tailwind CSS
- Search: `serpapi` npm package (official), direct REST calls — no MCP, no Python
- LLM (optional): any OpenAI-compatible endpoint via `LLM_BASE_URL` + `LLM_API_KEY`.
  Without a key the app falls back to an extractive report built from snippets.
- No database. History lives in the browser (localStorage).

## Agent loop (backend, `POST /api/research`, SSE progress stream)
The agent narrates every decision as `thought` events so the UI shows its
reasoning live — this is what makes it an agent, not a fixed pipeline.
1. **Plan** — parse entities from the query (split on "vs"/"versus"/commas;
   single topic → live "best X" discovery search). Announce the research plan.
2. **Research in parallel** — per entity: GitHub stats first (free api.github.com —
   stars, latest release, last activity, and the repo *homepage* which usually *is*
   the official docs URL, so the docs search is skipped); release-notes search
   (`site:github.com <entity> releases`); news/announcements (`tbm=nws`).
   ~2 SerpApi credits per entity, ≥1s between calls.
3. **Reflect** — fill gaps with targeted follow-ups (max 1 extra search per
   entity): no docs link → documentation-site search; no release → changelog search.
4. **Head-to-head deep dive** — top 2 contenders by stars get a dedicated
   `<A> vs <B> comparison migrate` search; snippets feed the verdict.
5. **Maintenance health** — free GitHub data (release dates, open issues,
   push activity, archived flag) → 0–100 score from recency (40) + cadence (30)
   + adoption-normalized issue load (30), with human-readable signals.
6. **Synthesize** — if `LLM_API_KEY` set: structured prompt → cited JSON report.
   Else: extractive report — composite pick (adoption 50% + health 50%), runner-up
   analysis, maintenance-risk warnings, and head-to-head references from collected evidence.
7. **Report JSON** — `{ entities: [{name, docsUrl, latestRelease, releaseDate, stars,
   health, summary, sources[]}], comparisonTable: [{aspect, values[]}], verdict,
   creditsUsed }`. Each entity retains the evidence links used during research.

### Reliability invariants
- SerpApi calls enter one global queue, preserving the free-tier interval even while entity
  research runs concurrently.
- Credit accounting is request-local, so overlapping visitors receive accurate cost totals.
- Optional LLM output can supply bounded summaries, qualitative rows, and a verdict, but cannot
  replace application-owned measurements, deterministic factual rows, or source records.
- SSE heartbeats and disabled proxy buffering keep long-running research visibly alive.

## Frontend pages
- Home: query input + example chips ("React Query vs SWR", "Zustand vs Redux"),
  live pipeline progress (SSE steps), report view.
- Report: evidence-quality strip, entity cards (docs link, latest release, stars), comparison
  table, verdict, collapsible evidence ledger with links, "Export Markdown" button.
- History: past reports from localStorage, re-open offline.

## Robustness / hackathon rules
- `SERPAPI_API_KEY` and optional `GITHUB_TOKEN` come from env only; never committed.
  `.env.example` is provided.
- Graceful degradation: SerpApi error → clear message + credits note;
  no LLM key → extractive mode banner.
- README documents: setup, env vars, how SerpApi is used (required by judges),
  credit budget (~5/run), demo video script outline.
