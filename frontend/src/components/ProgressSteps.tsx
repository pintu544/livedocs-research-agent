import type { Step } from "../hooks/useResearch";

export function ProgressSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="w-full max-w-2xl mx-auto mt-6 space-y-2" aria-live="polite">
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
  );
}
