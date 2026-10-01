import type { Report } from "../types";

export function reportToMarkdown(r: Report): string {
  const lines: string[] = [];
  lines.push(`# LiveDocs Research: ${r.query}`);
  lines.push("");
  lines.push(
    `_Generated ${new Date(r.generatedAt).toLocaleString("en-IN")} · mode: ${r.mode} · ${r.creditsUsed} SerpApi credits used_`
  );
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  lines.push(r.verdict);
  lines.push("");

  for (const e of r.entities) {
    lines.push(`## ${e.name}`);
    lines.push("");
    if (e.summary) lines.push(e.summary, "");
    lines.push(`- Docs: ${e.docsUrl ?? "—"}`);
    lines.push(
      `- Latest release: ${e.latestRelease ?? "—"}${e.releaseDate ? ` (${e.releaseDate})` : ""}`
    );
    lines.push(
      `- GitHub: ${e.repoUrl ?? "—"}${e.stars != null ? ` (${e.stars} stars)` : ""}`
    );
    if (e.health) {
      lines.push(`- Maintenance health: ${e.health.score}/100 (${e.health.signals.join("; ")})`);
    }
    lines.push("");
  }

  if (r.comparisonTable.length > 0) {
    lines.push("## Comparison");
    lines.push("");
    const header = ["Aspect", ...r.entities.map((e) => e.name)];
    lines.push(`| ${header.join(" | ")} |`);
    lines.push(`| ${header.map(() => "---").join(" | ")} |`);
    for (const row of r.comparisonTable) {
      lines.push(`| ${[row.aspect, ...row.values].join(" | ")} |`);
    }
    lines.push("");
  }

  lines.push("## Sources");
  lines.push("");
  for (const e of r.entities) {
    for (const s of e.sources) {
      lines.push(`- [${s.title}](${s.url})${s.date ? ` — ${s.date}` : ""}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function downloadMarkdown(r: Report) {
  const blob = new Blob([reportToMarkdown(r)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `livedocs-${r.query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
