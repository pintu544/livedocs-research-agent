export type SourceKind = "docs" | "release" | "news" | "repo" | "page";

export interface Source {
  title: string;
  url: string;
  snippet?: string;
  date?: string;
  kind: SourceKind;
}

export interface RepoHealth {
  fullName: string;
  score: number;
  daysSinceRelease: number | null;
  avgReleaseGapDays: number | null;
  openIssues: number | null;
  lastPushDaysAgo: number | null;
  archived: boolean;
  signals: string[];
}

export interface EntityResult {
  name: string;
  docsUrl?: string;
  docsTitle?: string;
  latestRelease?: string;
  releaseDate?: string;
  stars?: number;
  repoUrl?: string;
  lastUpdated?: string;
  summary?: string;
  health?: RepoHealth;
  sources: Source[];
}

export interface ComparisonRow {
  aspect: string;
  values: string[];
}

export interface Report {
  query: string;
  entities: EntityResult[];
  comparisonTable: ComparisonRow[];
  verdict: string;
  creditsUsed: number;
  generatedAt: string;
  mode: "llm" | "extractive";
}

export interface ProgressMsg {
  step: string;
  detail?: string;
  done?: boolean;
  error?: string;
}
