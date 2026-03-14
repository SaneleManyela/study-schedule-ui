import { createBrowserRouter } from "react-router";
import { MainPage } from "./pages/MainPage";
import { AdminPage } from "./pages/AdminPage";
import { AskPage } from "./pages/AskPage";
import { TruthEnginePage } from "./pages/TruthEnginePage";
import { SystemsHomePage } from "./pages/SystemsHomePage";
import { ResearchSystemLayout } from "./layouts/ResearchSystemLayout";
import { AssignmentSystemLayout } from "./layouts/AssignmentSystemLayout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: SystemsHomePage,
  },

  {
    path: "/research",
    Component: ResearchSystemLayout,
    children: [
      {
        path: "workbench",
        Component: MainPage,
      },
      {
        path: "ask",
        Component: AskPage,
      },
      {
        path: "admin",
        Component: AdminPage,
      },
    ],
  },

  {
    path: "/assignment",
    Component: AssignmentSystemLayout,
    children: [
      {
        path: "workflow",
        Component: TruthEnginePage,
      },
    ],
  },

  // Legacy aliases retained for compatibility
  {
    path: "/workbench",
    Component: MainPage,
  },
  {
    path: "/ask",
    Component: AskPage,
  },
  {
    path: "/admin",
    Component: AdminPage,
  },
  {
    path: "/truth-engine",
    Component: TruthEnginePage,
  },
  {
    path: "*",
    Component: SystemsHomePage,
  },
]);
