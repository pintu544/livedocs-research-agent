import { useState } from "react";
import type { Source, SourceKind } from "../types";

const KIND_LABEL: Record<SourceKind, string> = {
  docs: "Docs",
  release: "Release",
  news: "News",
  repo: "Repo",
  page: "Page",
};

const KIND_STYLE: Record<SourceKind, string> = {
  docs: "bg-indigo-100 text-indigo-700",
  release: "bg-emerald-100 text-emerald-700",
  news: "bg-amber-100 text-amber-700",
  repo: "bg-slate-200 text-slate-700",
  page: "bg-sky-100 text-sky-700",
};

export function SourcesList({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? sources : sources.slice(0, 5);

  if (sources.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <h3 className="font-bold text-ink">Sources ({sources.length})</h3>
      <ul className="mt-3 space-y-2.5">
        {shown.map((s, i) => (
          <li key={`${s.url}-${i}`} className="text-sm">
            <span
              className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLE[s.kind]}`}
            >
              {KIND_LABEL[s.kind]}
            </span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline break-all"
            >
              {s.title || s.url} ↗
            </a>
            {s.date && <span className="text-slate-400"> · {s.date}</span>}
          </li>
        ))}
      </ul>
      {sources.length > 5 && (
        <button
          onClick={() => setOpen(!open)}
          className="mt-3 text-sm font-medium text-accent hover:underline"
        >
          {open ? "Show fewer" : `Show all ${sources.length} sources`}
        </button>
      )}
    </section>
  );
}
