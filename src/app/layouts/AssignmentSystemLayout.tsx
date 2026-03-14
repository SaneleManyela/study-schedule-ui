import { Outlet } from "react-router";

import { AppMenuBar } from "../components/AppMenuBar";

export function AssignmentSystemLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppMenuBar onRefresh={() => window.location.reload()} />
      <div className="border-b border-border bg-card/40">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <p className="text-sm text-primary">System 2: Assignment Workflow Studio</p>
          <p className="text-xs text-muted-foreground">
            Build assignments thoroughly, effectively, and efficiently for excellent final outcomes.
          </p>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
