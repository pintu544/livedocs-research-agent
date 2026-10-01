# LiveDocs Research Agent

**SerpApi India Hackathon 2026 · AI Agents track · Solo entry by Pintu Kumar**

An AI research assistant that compares libraries and tools using **live** documentation,
release announcements, and community signals — every claim backed by a sourced link.

Ask `"React Query vs SWR"` (or `"best Node.js ORMs"`) and get a comparison report built
from data fetched seconds ago via SerpApi — not from stale training knowledge.

## How it works

1. **Plan** — the query is split into entities (`"A vs B"`, `"A, B, C"`); a single topic
   like `"best Python web frameworks"` triggers a live discovery search for the top contenders.
   The agent announces its research plan as a live reasoning trace.
2. **Research (SerpApi + GitHub)** — for each entity, in parallel:
   - GitHub stats first (free api.github.com): stars, latest release, last activity —
     the repo's homepage URL usually *is* the official docs site, so it's used
     directly as the docs link (no search credit spent).
   - Official documentation search (`engine=google`, `"<entity> official documentation"`) —
     only when the repo has no homepage; candidates are ranked by entity-name match.
   - Release notes (`site:github.com <entity> releases`)
   - News & announcements (`engine=google`, `tbm=nws`)
   - All SerpApi calls are throttled to ≥1s apart (free-tier rate limit).
3. **Reflect** — the agent inspects gaps (missing docs link? missing release?) and runs
   targeted follow-up searches, narrating each decision.
4. **Head-to-head deep dive** — the two most-starred contenders get a dedicated
   `<A> vs <B> comparison migrate` search for trade-offs and migration notes.
5. **Maintenance health** — free GitHub data (release cadence, recency, open issues,
   archived flag) becomes a 0–100 score with human-readable signals.
6. **Synthesize** — if an OpenAI-compatible LLM key is configured, a structured prompt
   produces a cited JSON report; otherwise an extractive report is built from live
   data (composite pick: adoption 50% + health 50%, runner-up analysis, risk warnings).
7. **Report** — entity cards with health badges, comparison table, verdict, live agent
   reasoning log, collapsible source list, one-click Markdown export, and
   localStorage history. Progress streams over SSE.

## Quick start

**Prerequisites:** Node.js 20+

```bash
# 1. Backend
cd backend
cp .env.example .env        # add your SERPAPI_API_KEY (free: https://serpapi.com/users/sign_up)
npm install
npm run dev                 # http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to the backend)
```

Production: `npm run build` in both folders — the backend serves `frontend/dist` automatically.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `SERPAPI_API_KEY` | ✅ | SerpApi key for all live searches (free plan: 250 searches/month, no card) |
| `PORT` | – | Backend port (default `4000`) |
| `LLM_BASE_URL` | – | OpenAI-compatible endpoint (default `https://api.openai.com/v1`) |
| `LLM_MODEL` | – | Chat model (default `gpt-4o-mini`) |
| `LLM_API_KEY` | – | Enables AI-written summaries/verdicts; without it the app runs in extractive mode |

## How the project uses SerpApi

SerpApi is the data backbone of the project — every number and claim in a report comes
from a live SerpApi search:

- **Google Search API** (`engine=google`) finds each library's official documentation and
  release-note pages, using scoped queries like `site:github.com <entity> releases`.
- **Google News vertical** (`tbm=nws`) surfaces the latest launch/update announcements.
- Snippets, titles, links, and result dates from `organic_results` / `news_results` feed
  the report directly; each source is rendered with a clickable link and a kind badge
  (Docs / Release / News / Repo / Page).
- The official `serpapi` npm package is used for all calls; 1 search = 1 credit.

**Credit budget:** ~2 credits per entity (releases + news; the docs search is skipped
when the GitHub repo homepage already points at the official docs), plus 1 for
discovery mode — a typical 2-way comparison costs **~4 credits**. The free
250/month plan covers ~60 comparisons; a valid hackathon submission adds 1,000
bonus credits (~250 comparisons).

## API

- `GET /api/health` — `{ ok, serpApiConfigured, llmConfigured, time }`
- `POST /api/research` — body `{ "query": "React Query vs SWR" }`; streams
  `text/event-stream` progress events, ending with a `report` event containing the JSON report.

## Project structure

```
backend/
  src/index.ts        Express server + SSE endpoint
  src/agent.ts        Agent loop: plan → research → reflect → head-to-head → health → synthesize
  src/parse.ts        Query → entity parsing (+ live discovery mode)
  src/research.ts     Per-entity SerpApi pipeline (docs, releases, news, GitHub)
  src/serpapi.ts      Throttled SerpApi client (≥1s between calls, credit counter)
  src/github.ts       Free GitHub API lookups (no SerpApi credit)
  src/health.ts       Maintenance-health scoring from GitHub data (0–100)
  src/synthesize.ts   Optional OpenAI-compatible LLM synthesis
  src/extractive.ts   No-LLM fallback report builder (composite scoring, risk warnings)
frontend/
  src/App.tsx         Main view: form → progress → report → history
  src/hooks/useResearch.ts   SSE client state machine
  src/components/    QueryForm, ProgressSteps, EntityCard, ComparisonTable, SourcesList
  src/utils/         Markdown export, localStorage history
```

## AI-tools disclosure

As required by the hackathon rules: this project was built with **Muse**, Meta's AI
assistant (agentic coding help for architecture, implementation, and documentation).
SerpApi is the only external data API; an optional OpenAI-compatible LLM may be used
for summarization, with an extractive fallback when no key is configured.

## Demo video script (≤3 min)

1. (0:00–0:20) Hook: "LLMs hallucinate library comparisons — this agent reads live docs."
2. (0:20–1:00) Type "React Query vs SWR", show the live reasoning trace as the agent plans, reflects, and deep-dives.
3. (1:00–2:00) Walk the report: entity cards with maintenance-health badges, comparison table, verdict with runner-up analysis.
4. (2:00–2:30) Expand sources — every claim links to a live page; Export Markdown.
5. (2:30–3:00) History re-open + "how SerpApi is used" + credits used counter.
