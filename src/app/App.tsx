import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StudyProvider } from "./lib/study-context";

export default function App() {
  return (
    <ErrorBoundary>
      <StudyProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </StudyProvider>
    </ErrorBoundary>
  );
}
