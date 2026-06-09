export interface ScheduleItem {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  resourceTitle?: string | null;
  resourceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyPlanItem {
  id: string;
  title: string;
  goal: string;
  sessionDate: string;
  durationMinutes: number;
  notes: string;
  resourceTitle?: string | null;
  resourceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchedulePayload {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  resourceTitle?: string;
  resourceUrl?: string;
}

export interface CreateStudyPlanPayload {
  title: string;
  goal: string;
  sessionDate: string;
  durationMinutes: number;
  notes: string;
  resourceTitle?: string;
  resourceUrl?: string;
}

const API_BASE_URL =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL as string | undefined)?.trim() ||
  "http://127.0.0.1:8000";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function listSchedules(): Promise<ScheduleItem[]> {
  return requestJson<ScheduleItem[]>("/api/schedules");
}

export function createSchedule(payload: CreateSchedulePayload): Promise<ScheduleItem> {
  return requestJson<ScheduleItem>("/api/schedules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listStudyPlans(): Promise<StudyPlanItem[]> {
  return requestJson<StudyPlanItem[]>("/api/study-plans");
}

export function createStudyPlan(payload: CreateStudyPlanPayload): Promise<StudyPlanItem> {
  return requestJson<StudyPlanItem>("/api/study-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AuthResult {
  success: boolean;
  error?: string | null;
}

export function verifyAdminPassword(password: string): Promise<AuthResult> {
  return requestJson<AuthResult>("/api/auth/verify-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function sendAdminPin(): Promise<AuthResult> {
  return requestJson<AuthResult>("/api/auth/send-pin", { method: "POST" });
}

export function verifyAdminPin(pin: string): Promise<AuthResult> {
  return requestJson<AuthResult>("/api/auth/verify-pin", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}