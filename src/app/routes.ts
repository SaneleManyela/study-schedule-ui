import { createBrowserRouter } from "react-router";
import { SystemsHomePage } from "./pages/SystemsHomePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: SystemsHomePage,
  },
  {
    path: "*",
    Component: SystemsHomePage,
  },
]);
