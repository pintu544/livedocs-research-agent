import type { EntityResult } from "../types";

function fmtStars(n?: number): string {
  if (n == null) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtDate(d?: string): string {
  if (!d) return "—";
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function EntityCard({ entity }: { entity: EntityResult }) {
  const h = entity.health;
  const healthColor =
    !h ? "" : h.score >= 70 ? "bg-emerald-100 text-emerald-800" : h.score >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-ink">{entity.name}</h3>
        {h && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${healthColor}`}
            title={h.signals.join(" · ")}
          >
            ♥ {h.score}/100
          </span>
        )}
      </div>
      {entity.summary && (
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{entity.summary}</p>
      )}
      {h && h.signals.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">{h.signals.slice(0, 2).join(" · ")}</p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Docs</dt>
          <dd className="mt-0.5">
            {entity.docsUrl ? (
              <a
                href={entity.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline break-all"
              >
                {entity.docsTitle ?? "Official docs"} ↗
              </a>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Latest release</dt>
          <dd className="mt-0.5 text-slate-800">
            {entity.latestRelease ?? "—"}
            {entity.releaseDate && (
              <span className="text-slate-500"> · {fmtDate(entity.releaseDate)}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">GitHub stars</dt>
          <dd className="mt-0.5 text-slate-800">
            {entity.repoUrl ? (
              <a
                href={entity.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                ★ {fmtStars(entity.stars)} ↗
              </a>
            ) : (
              `★ ${fmtStars(entity.stars)}`
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Last activity</dt>
          <dd className="mt-0.5 text-slate-800">{fmtDate(entity.lastUpdated)}</dd>
        </div>
      </dl>
    </article>
  );
}
