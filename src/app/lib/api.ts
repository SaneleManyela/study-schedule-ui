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

  return (await response.json()) as ResearchResponse;
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