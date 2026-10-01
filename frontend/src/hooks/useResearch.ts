import { useCallback, useRef, useState } from "react";
import type { ProgressMsg, Report } from "../types";

export type Phase = "idle" | "running" | "done" | "error";

export interface Step {
  id: string;
  label: string;
  detail?: string;
  active: boolean;
  finished: boolean;
}

const STEP_ORDER = ["parse", "search", "github", "synthesize", "done"];

const STEP_LABELS: Record<string, string> = {
  parse: "Parsing query",
  search: "Live search via SerpApi",
  github: "GitHub stats",
  synthesize: "Building report",
  done: "Report ready",
};

export function useResearch() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setPhase("running");
    setReport(null);
    setError(null);
    setThoughts([]);
    setSteps(
      STEP_ORDER.map((id, i) => ({
        id,
        label: STEP_LABELS[id],
        active: i === 0,
        finished: false,
      }))
    );

    const markStep = (id: string, detail?: string) => {
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx === -1) return prev;
        return prev.map((s, i) => ({
          ...s,
          active: i === idx,
          finished: i < idx ? true : s.finished,
          detail: i === idx ? detail ?? s.detail : s.detail,
        }));
      });
    };

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Server error ${res.status}`);
      }
      if (!res.body) throw new Error("Streaming not supported by this browser.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleMsg = (msg: ProgressMsg) => {
        if (msg.step === "report" && msg.done && msg.detail) {
          const parsed = JSON.parse(msg.detail) as Report;
          setReport(parsed);
          setSteps((prev) => prev.map((s) => ({ ...s, active: false, finished: true })));
          setPhase("done");
        } else if (msg.step === "error") {
          throw new Error(msg.error ?? "Research failed");
        } else if (msg.step === "thought" && msg.detail) {
          setThoughts((prev) => [...prev.slice(-29), msg.detail as string]);
        } else if (STEP_ORDER.includes(msg.step)) {
          markStep(msg.step, msg.detail);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            handleMsg(JSON.parse(line.slice(6)) as ProgressMsg);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setPhase("error");
    }
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { phase, steps, thoughts, report, error, run, cancel, setReport, setPhase };
}
