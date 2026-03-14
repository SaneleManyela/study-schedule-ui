import { Outlet } from "react-router";

import { AppMenuBar } from "../components/AppMenuBar";

export function ResearchSystemLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppMenuBar onRefresh={() => window.location.reload()} />
      <div className="border-b border-border bg-card/40">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <p className="text-sm text-primary">System 1: Evidence-First Research Pipeline</p>
          <p className="text-xs text-muted-foreground">
            Transform static academic documents into interactive, queryable evidence sources.
          </p>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
