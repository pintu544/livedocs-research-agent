import type { ComparisonRow, EntityResult } from "../types";

export function ComparisonTable({
  rows,
  entities,
}: {
  rows: ComparisonRow[];
  entities: EntityResult[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-4 py-3 text-left font-semibold text-slate-500">Aspect</th>
            {entities.map((e) => (
              <th key={e.name} className="px-4 py-3 text-left font-semibold text-ink">
                {e.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.aspect} className="border-t border-slate-100 align-top">
              <td className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">
                {row.aspect}
              </td>
              {row.values.map((v, i) => (
                <td key={i} className="px-4 py-3 text-slate-700">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
