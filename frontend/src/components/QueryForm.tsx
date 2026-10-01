import { useState } from "react";

const EXAMPLES = [
  "React Query vs SWR",
  "Zustand vs Redux Toolkit",
  "Fastify vs Express",
  "Drizzle vs Prisma",
  "best Python web frameworks",
];

export function QueryForm({
  onRun,
  running,
}: {
  onRun: (q: string) => void;
  running: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = (q: string) => {
    const query = q.trim();
    if (query && !running) onRun(query);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='e.g. "React Query vs SWR" or "best Node.js ORMs"'
          aria-label="Research query"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm sm:text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={running || !value.trim()}
          className="rounded-xl bg-accent px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold text-white shadow-sm disabled:opacity-50 hover:bg-indigo-700 transition"
        >
          {running ? "Researching…" : "Research"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2 justify-center">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => submit(ex)}
            disabled={running}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 transition disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
