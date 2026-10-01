import { useEffect, useState } from "react";
import { useResearch } from "./hooks/useResearch";
import { QueryForm } from "./components/QueryForm";
import { ProgressSteps } from "./components/ProgressSteps";
import { EntityCard } from "./components/EntityCard";
import { ComparisonTable } from "./components/ComparisonTable";
import { SourcesList } from "./components/SourcesList";
import { downloadMarkdown } from "./utils/export";
import { clearHistory, loadHistory, saveToHistory } from "./utils/history";
import type { Report } from "./types";
import "./index.css";

function fmtDateTime(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function App() {
  const { phase, steps, report, error, run, setReport, setPhase } = useResearch();
  const [history, setHistory] = useState<Report[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (phase === "done" && report) {
      setHistory(saveToHistory(report));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const openFromHistory = (r: Report) => {
    setReport(r);
    setPhase("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const running = phase === "running";
  const allSources = report?.entities.flatMap((e) => e.sources) ?? [];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:py-5 flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">📚</span>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
              LiveDocs Research Agent
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Compare libraries with live docs, releases & community signals — powered by SerpApi
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <QueryForm onRun={run} running={running} />

        {running && <ProgressSteps steps={steps} />}

        {phase === "error" && error && (
          <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <p className="font-semibold">Research failed</p>
            <p className="mt-1">{error}</p>
            {!/SERPAPI_API_KEY/.test(error) && (
              <p className="mt-1 text-red-600">
                Tip: each run uses a few SerpApi credits — check your quota at serpapi.com.
              </p>
            )}
          </div>
        )}

        {phase === "done" && report && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold">“{report.query}”</h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  {fmtDateTime(report.generatedAt)} · {report.creditsUsed} SerpApi credits ·
                  mode: {report.mode === "llm" ? "AI summary" : "extractive"}
                </p>
              </div>
              <button
                onClick={() => downloadMarkdown(report)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              >
                ⬇ Export Markdown
              </button>
            </div>

            {report.mode === "extractive" && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs sm:text-sm text-amber-800">
                Running in extractive mode (no LLM key configured) — values are quoted straight
                from live search results, with sources below.
              </p>
            )}

            <div
              className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5 text-sm sm:text-base leading-relaxed"
              // verdict may contain **bold** markers from extractive mode
              dangerouslySetInnerHTML={{
                __html: report.verdict
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"),
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {report.entities.map((e) => (
                <EntityCard key={e.name} entity={e} />
              ))}
            </div>

            {report.comparisonTable.length > 0 && (
              <ComparisonTable rows={report.comparisonTable} entities={report.entities} />
            )}

            <SourcesList sources={allSources} />
          </div>
        )}

        {history.length > 0 && !running && (
          <section className="mt-12">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">History</h2>
              <button
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
              >
                Clear
              </button>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {history.map((h) => (
                <li key={h.generatedAt + h.query}>
                  <button
                    onClick={() => openFromHistory(h)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-accent transition"
                  >
                    <p className="truncate text-sm font-semibold">{h.query}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {fmtDateTime(h.generatedAt)} · {h.entities.length} compared
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-400">
          LiveDocs Research Agent · SerpApi India Hackathon 2026 (AI Agents track) · Every claim
          links to a live source.
        </div>
      </footer>
    </div>
  );
}
