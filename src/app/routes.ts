import { createBrowserRouter, redirect } from "react-router";
import { SystemsHomePage } from "./pages/SystemsHomePage";
import { LoginPage } from "./pages/LoginPage";
import { AdminPage } from "./pages/AdminDashboard";

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
      Component: SystemsHomePage,
    },
    {
      path: "/login",
      Component: LoginPage,
    },
    {
      path: "/admin",
      loader: requireAdmin,
      Component: AdminPage,
    },
    {
      path: "*",
      Component: SystemsHomePage,
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
