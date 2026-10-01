import "dotenv/config";
import express from "express";
import cors from "cors";
import { runAgent } from "./agent.js";
import type { ProgressMsg, Report } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    serpApiConfigured: Boolean(process.env.SERPAPI_API_KEY),
    llmConfigured: Boolean(process.env.LLM_API_KEY),
    time: new Date().toISOString(),
  });
});

/**
 * POST /api/research — runs the agent pipeline and streams progress as SSE.
 * Body: { "query": "React Query vs SWR" }
 * Events: data: {"step": "...", "detail": "..."} ... final: data: {"done": true, "report": {...}}
 */
app.post("/api/research", async (req, res) => {
  const query = String(req.body?.query ?? "").trim();
  if (!query) {
    res.status(400).json({ error: "Missing 'query' in request body." });
    return;
  }
  if (query.length > 200) {
    res.status(400).json({ error: "Query is too long. Keep it under 200 characters." });
    return;
  }
  if (!process.env.SERPAPI_API_KEY) {
    res.status(500).json({
      error:
        "SERPAPI_API_KEY is not configured on the server. Add it to backend/.env (see .env.example).",
    });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  // Keep proxies from closing the connection during throttled search calls.
  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 15_000);

  const send = (step: string, detail?: string) => {
    const msg: ProgressMsg = { step, detail };
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  try {
    const report: Report = await runAgent(query, (step, detail) => send(step, detail));

    send("done", `Report ready (${report.mode} mode) — ${report.creditsUsed} SerpApi credits used.`);
    const done: ProgressMsg = { step: "report", done: true, detail: JSON.stringify(report) };
    res.write(`data: ${JSON.stringify(done)}\n\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const msg: ProgressMsg = { step: "error", error: message };
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

// Optional: serve the built frontend from ../frontend/dist when present.
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(here, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`LiveDocs Research Agent backend on http://localhost:${PORT}`);
});
