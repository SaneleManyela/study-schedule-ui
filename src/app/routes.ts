import { createBrowserRouter } from "react-router";
import { MainPage } from "./pages/MainPage";
import { AdminPage } from "./pages/AdminPage";
import { AskPage } from "./pages/AskPage";
import { TruthEnginePage } from "./pages/TruthEnginePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: TruthEnginePage,
  },
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
]);
