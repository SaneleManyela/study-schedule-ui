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

export function verifyAdminPassword(email: string, password: string): Promise<AuthResult> {
  return requestJson<AuthResult>("/api/auth/verify-password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function sendAdminPin(email: string): Promise<AuthResult> {
  return requestJson<AuthResult>("/api/auth/send-pin", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyAdminPin(email: string, pin: string): Promise<AuthResult> {
  return requestJson<AuthResult>("/api/auth/verify-pin", {
    method: "POST",
    body: JSON.stringify({ email, pin }),
  });
}

// ─── Courses ────────────────────────────────────────────────────────────────

export type CourseStatus = "enrolled" | "in-progress" | "completed" | "shelf";

export interface Course {
  id: string;
  name: string;
  status: CourseStatus;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCoursePayload {
  name: string;
  status: CourseStatus;
  category?: string;
}

export function listCourses(): Promise<Course[]> {
  return requestJson<Course[]>("/api/courses");
}

export function createCourse(payload: CreateCoursePayload): Promise<Course> {
  return requestJson<Course>("/api/courses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCourse(id: string, payload: Partial<CreateCoursePayload>): Promise<Course> {
  return requestJson<Course>(`/api/courses/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteCourse(id: string): Promise<void> {
  return requestJson<void>(`/api/courses/${id}`, { method: "DELETE" });
}

// ─── Library Items ────────────────────────────────────────────────────────────

export type LibraryItemType = "pdf" | "url";

export interface LibraryItem {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  type: LibraryItemType;
  /** base64 data URI for PDFs, plain URL for links */
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibraryItemPayload {
  courseId: string;
  courseName: string;
  title: string;
  type: LibraryItemType;
  content: string;
}

export function listLibraryItems(): Promise<LibraryItem[]> {
  return requestJson<LibraryItem[]>("/api/library");
}

export function createLibraryItem(payload: CreateLibraryItemPayload): Promise<LibraryItem> {
  return requestJson<LibraryItem>("/api/library", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteLibraryItem(id: string): Promise<void> {
  return requestJson<void>(`/api/library/${id}`, { method: "DELETE" });
}

// ─── Course Notes ─────────────────────────────────────────────────────────────

export interface CourseNote {
  courseId: string;
  content: string;
  updatedAt: string;
}

export function getCourseNote(courseId: string): Promise<CourseNote | null> {
  return requestJson<CourseNote | null>(`/api/notes/${courseId}`);
}

export function upsertCourseNote(courseId: string, content: string): Promise<CourseNote> {
  return requestJson<CourseNote>(`/api/notes/${courseId}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

// ─── Local Storage Helpers ────────────────────────────────────────────────────

export const LS_COURSES = "study-planner-courses";
export const LS_LIBRARY = "study-planner-library";

export function loadLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const val = JSON.parse(raw);
    return Array.isArray(val) ? (val as T[]) : [];
  } catch {
    return [];
  }
}

export function saveLocal<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}