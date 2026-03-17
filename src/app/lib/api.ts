import type {
  ResearchDocument,
  ResearchProfile,
  ResearchResponse,
  ResearchSettings,
} from "./workbench";

export interface WorkflowStepRunResult {
  id: number;
  title: string;
  status: "todo" | "in-progress" | "done" | "blocked";
  action: string;
  message: string;
  launchUrl: string | null;
}

export interface WorkflowRunResponse {
  status: "ready" | "blocked";
  summary: string;
  steps: WorkflowStepRunResult[];
}

interface QueryPayload {
  question: string;
  documents: ResearchDocument[];
  settings: ResearchSettings;
  profile: ResearchProfile;
}

const API_BASE_URL =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL as string | undefined)?.trim() ||
  "http://127.0.0.1:8000";

function normalizeResearchResponse(raw: unknown): ResearchResponse {
  const value = (raw ?? {}) as Partial<ResearchResponse>;

  return {
    title: typeof value.title === "string" && value.title.trim().length > 0
      ? value.title
      : "Research response received",
    summary: typeof value.summary === "string" && value.summary.trim().length > 0
      ? value.summary
      : "The backend returned an empty summary.",
    evidence: Array.isArray(value.evidence)
      ? value.evidence.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    nextAction: typeof value.nextAction === "string" && value.nextAction.trim().length > 0
      ? value.nextAction
      : "Review backend logs for additional response details.",
  };
}

export async function queryResearch(payload: QueryPayload): Promise<ResearchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/research/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Backend request failed with status ${response.status}`);
  }

  const data = await response.json();
  return normalizeResearchResponse(data);
}

export async function runWorkflow(email: string): Promise<WorkflowRunResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Workflow request failed with status ${response.status}`);
  }

  return (await response.json()) as WorkflowRunResponse;
}