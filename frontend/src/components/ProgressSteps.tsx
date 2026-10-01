import { useEffect, useRef } from "react";
import type { Step } from "../hooks/useResearch";

export function ProgressSteps({ steps, thoughts }: { steps: Step[]; thoughts: string[] }) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thoughts.length]);

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 space-y-3">
      <ol className="space-y-2" aria-live="polite">
        {steps.map((s) => (
          <li
            key={s.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              s.active
                ? "border-accent bg-indigo-50"
                : s.finished
                  ? "border-slate-200 bg-white"
                  : "border-slate-100 bg-slate-50 text-slate-400"
            }`}
          >
            <span
              className={`mt-0.5 inline-block h-3 w-3 rounded-full shrink-0 ${
                s.active
                  ? "bg-accent step-active"
                  : s.finished
                    ? "bg-emerald-500"
                    : "bg-slate-300"
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-medium text-slate-800">{s.label}</p>
              {s.detail && (
                <p className="truncate text-slate-500 text-xs sm:text-sm">{s.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {thoughts.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-200">
          <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            🧠 Agent reasoning
          </p>
          <div ref={logRef} className="max-h-48 overflow-y-auto px-4 pb-3 pt-1 space-y-1.5">
            {thoughts.map((t, i) => (
              <p key={i} className="text-xs sm:text-sm leading-relaxed">
                <span className="text-indigo-400 mr-1.5">›</span>
                {t}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
