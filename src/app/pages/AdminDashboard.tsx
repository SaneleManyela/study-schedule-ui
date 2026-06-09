import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { CalendarClock, ListChecks, LogOut } from "lucide-react";

export function AdminPage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("studyPlannerAdmin");
    localStorage.removeItem("studyPlannerEmail");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,168,133,0.20),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(39,83,210,0.16),transparent_30%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-10 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl leading-tight">Admin Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Logged in as: {localStorage.getItem("studyPlannerEmail") ?? "admin"}
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card
              className="border-primary/30 bg-card/80 backdrop-blur cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => navigate("/")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CalendarClock className="h-5 w-5" />
                  Study Planner
                </CardTitle>
                <CardDescription>
                  View the full calendar and study schedule interface.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage all schedules and study plans across all learning resources.
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-primary/30 bg-card/80 backdrop-blur cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => navigate("/")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <ListChecks className="h-5 w-5" />
                  Study Plans
                </CardTitle>
                <CardDescription>
                  View all study plans saved to Firestore.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Review goals, durations, and session notes per resource.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
