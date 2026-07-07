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
    ?.VITE_API_BASE_URL as string | undefined)?.trim() ??
  "https://study-schedule-ui.onrender.com";

// ---------------------------------------------------------------------------
// Session token management
// ---------------------------------------------------------------------------

const _LS_TOKEN = "studyPlannerToken";
const _LS_ADMIN = "studyPlannerAdmin";
const _LS_EMAIL = "studyPlannerEmail";

export function setAuthToken(token: string): void {
  localStorage.setItem(_LS_TOKEN, token);
}

export function clearAuthSession(): void {
  localStorage.removeItem(_LS_TOKEN);
  localStorage.removeItem(_LS_ADMIN);
  localStorage.removeItem(_LS_EMAIL);
  localStorage.removeItem("studyPlannerRole");
}

export function proxyUrl(targetUrl: string): string {
  return `${API_BASE_URL}/api/proxy?url=${encodeURIComponent(targetUrl)}`;
}

export async function checkEmbeddable(targetUrl: string): Promise<{ embeddable: boolean; reason: string | null }> {
  const resp = await fetch(`${API_BASE_URL}/api/proxy?url=${encodeURIComponent(targetUrl)}&info=1`);
  if (!resp.ok) return { embeddable: false, reason: `proxy check failed (${resp.status})` };
  return resp.json() as Promise<{ embeddable: boolean; reason: string | null }>;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(_LS_TOKEN);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (response.status === 401) {
    clearAuthSession();
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  // Intercept backend crashes returning generic HTML templates instead of clean JSON data
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error("Server returned HTML instead of JSON. Check your backend routing or server logs on Render.com.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Clean wrapper function imported by Dashboard layouts
 */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(path, init);
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

export interface PinVerifyResult extends AuthResult {
  token?: string | null;
  role?: string | null;
}

export function getRole(): string | null {
  return localStorage.getItem("studyPlannerRole");
}

export function verifyAdminPassword(email: string, password: string): Promise<AuthResult> {
  return requestJson<AuthResult>("/api/auth/verify-password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function checkAdminEmail(email: string): Promise<{ exists: boolean; error?: string | null }> {
  return requestJson<{ exists: boolean; error?: string | null }>("/api/auth/check-email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function signupAdmin(email: string, password: string): Promise<AuthResult> {
  return requestJson<AuthResult>("/api/auth/signup", {
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

export function verifyAdminPin(email: string, pin: string): Promise<PinVerifyResult> {
  return requestJson<PinVerifyResult>("/api/auth/verify-pin", {
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
  hasCertificate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCoursePayload {
  name: string;
  status: CourseStatus;
  category?: string;
  hasCertificate: boolean;
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

// ─── Categories ───────────────────────────────────────────────────────────────

export const LS_CATEGORIES = "studyPlannerCategories";

export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function listCategories(): Promise<Category[]> {
  return requestJson<Category[]>("/api/categories");
}

export function createCategory(name: string): Promise<Category> {
  return requestJson<Category>("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateCategory(id: string, name: string): Promise<Category> {
  return requestJson<Category>(`/api/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export function deleteCategory(id: string): Promise<void> {
  return requestJson<void>(`/api/categories/${id}`, { method: "DELETE" });
}

// ─── Languages ────────────────────────────────────────────────────────────────

export const LS_LANGUAGES = "studyPlannerLanguages";

export type LanguageLevel =
  | "Beginner"
  | "Elementary"
  | "Intermediate"
  | "Upper-Intermediate"
  | "Advanced"
  | "Fluent"
  | "Native";

export const LANGUAGE_LEVELS: LanguageLevel[] = [
  "Beginner",
  "Elementary",
  "Intermediate",
  "Upper-Intermediate",
  "Advanced",
  "Fluent",
  "Native",
];

export interface Language {
  id: string;
  name: string;
  level: LanguageLevel;
  createdAt: string;
  updatedAt: string;
}

export function listLanguages(): Promise<Language[]> {
  return requestJson<Language[]>("/api/languages");
}

export function createLanguage(name: string, level: LanguageLevel): Promise<Language> {
  return requestJson<Language>("/api/languages", {
    method: "POST",
    body: JSON.stringify({ name, level }),
  });
}

export function updateLanguage(id: string, name: string, level: LanguageLevel): Promise<Language> {
  return requestJson<Language>(`/api/languages/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, level }),
  });
}

export function deleteLanguage(id: string): Promise<void> {
  return requestJson<void>(`/api/languages/${id}`, { method: "DELETE" });
}

// ─── Library Items ────────────────────────────────────────────────────────────

export interface LibraryItem {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  type: string;
  content: string;
  language?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibraryItemPayload {
  courseId: string;
  courseName: string;
  title: string;
  type: string;
  content: string;
  language?: string | null;
}

export interface UpdateLibraryItemPayload {
  courseId?: string;
  courseName?: string;
  title?: string;
  type?: string;
  content?: string;
  language?: string | null;
}

export function listLibraryItems(): Promise<LibraryItem[]> {
  return requestJson<LibraryItem[]>("/api/library");
}

export function getLibraryItem(id: string): Promise<LibraryItem> {
  return requestJson<LibraryItem>(`/api/library/${id}`);
}

export function createLibraryItem(payload: CreateLibraryItemPayload): Promise<LibraryItem> {
  return requestJson<LibraryItem>("/api/library", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLibraryItem(id: string, payload: UpdateLibraryItemPayload): Promise<LibraryItem> {
  return requestJson<LibraryItem>(`/api/library/${id}`, {
    method: "PUT",
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