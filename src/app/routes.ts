import { createBrowserRouter, redirect } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { AdminLayout } from "./pages/AdminLayout";
import { DashboardHome } from "./pages/DashboardHome";
import { CourseOverviewPage } from "./pages/CourseOverviewPage";
import { StudyCalendarPage } from "./pages/StudyCalendarPage";
import { StudyPlanPage } from "./pages/StudyPlanPage";
import { LibraryPage } from "./pages/LibraryPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { CourseNotesPage } from "./pages/CourseNotesPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { LanguagesPage } from "./pages/LanguagesPage";

function getSession() {
  const loggedIn = localStorage.getItem("studyPlannerAdmin") === "true";
  const token = localStorage.getItem("studyPlannerToken");
  const role = localStorage.getItem("studyPlannerRole") ?? "admin";
  // Must have both the admin flag AND a session token
  return (loggedIn && token) ? role : null;
}

function requireAuth() {
  if (!getSession()) return redirect("/login");
  return null;
}

function requireAdmin() {
  const role = getSession();
  if (!role) return redirect("/login");
  if (role !== "admin") return redirect("/admin"); // user role: redirect to dashboard, not 403
  return null;
}

export const router = createBrowserRouter(
  [
    {
      path: "/",
      loader: () => redirect("/login"),
    },
    {
      path: "/login",
      Component: LoginPage,
    },
    {
      path: "/admin",
      loader: requireAuth,
      Component: AdminLayout,
      children: [
        // ── accessible to all authenticated roles ──────────────────────────
        { index: true, Component: DashboardHome },
        { path: "courses", Component: CourseOverviewPage },
        { path: "courses/:id", Component: CourseDetailPage },
        { path: "calendar", Component: StudyCalendarPage },
        { path: "study-plan", Component: StudyPlanPage },
        { path: "library", Component: LibraryPage },
        { path: "categories", Component: CategoriesPage },
        { path: "languages", Component: LanguagesPage },
        // ── user role only: notes belong to users, not admins ──────────────
        { path: "courses/:id/notes", loader: requireAuth, Component: CourseNotesPage },
      ],
    },
    {
      path: "*",
      loader: () => redirect("/login"),
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
