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

function requireAdmin() {
  const isAdmin = localStorage.getItem("studyPlannerAdmin") === "true";
  if (!isAdmin) {
    return redirect("/login");
  }
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
      loader: requireAdmin,
      Component: AdminLayout,
      children: [
        { index: true, Component: DashboardHome },
        { path: "courses", Component: CourseOverviewPage },
        { path: "courses/:id", Component: CourseDetailPage },
        { path: "courses/:id/notes", Component: CourseNotesPage },
        { path: "calendar", Component: StudyCalendarPage },
        { path: "study-plan", Component: StudyPlanPage },
        { path: "library", Component: LibraryPage },
      ],
    },
    {
      path: "*",
      loader: () => redirect("/login"),
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
