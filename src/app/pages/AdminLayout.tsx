import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Library,
  LogOut,
  Menu,
  X,
  Bell,
  NotebookPen,
  ChevronDown,
  ChevronRight,
  Tag,
  Languages,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../components/ui/utils";
import { loadLocal, LS_COURSES, type Course, clearAuthSession } from "../lib/api";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Course Overview", to: "/admin/courses", icon: BookOpen, end: false },
  { label: "Categories", to: "/admin/categories", icon: Tag, end: false },
  { label: "Languages", to: "/admin/languages", icon: Languages, end: false },
  { label: "Study Calendar", to: "/admin/calendar", icon: CalendarDays, end: false },
  { label: "Study Plan", to: "/admin/study-plan", icon: ClipboardList, end: false },
  { label: "Library", to: "/admin/library", icon: Library, end: false },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications] = useState(3);
  const [notesOpen, setNotesOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    setCourses(loadLocal<Course>(LS_COURSES));
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col shrink-0 border-r border-border bg-card transition-all duration-300",
          sidebarOpen ? "w-60" : "w-16",
        )}
      >
        {/* Logo / toggle */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-border">
          {sidebarOpen && (
            <span className="text-primary font-bold text-lg tracking-tight truncate">
              StudyPlanner
            </span>
          )}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  !sidebarOpen && "justify-center px-2",
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}

          {/* Notes section */}
          {sidebarOpen && (
            <div className="pt-2">
              <button
                onClick={() => setNotesOpen((v) => !v)}
                className="flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <NotebookPen className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left truncate">Notes</span>
                {notesOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </button>
              {notesOpen && (
                <div className="ml-8 mt-0.5 space-y-0.5">
                  {courses.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-1 italic">No courses yet</p>
                  ) : (
                    courses.map((c) => (
                      <NavLink
                        key={c.id}
                        to={`/admin/courses/${c.id}/notes`}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors truncate",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )
                        }
                      >
                        <NotebookPen className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </NavLink>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes icon when collapsed */}
          {!sidebarOpen && (
            <NavLink
              to="/admin/courses"
              className="flex items-center justify-center rounded-md px-2 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Notes (expand sidebar to browse)"
            >
              <NotebookPen className="h-5 w-5 shrink-0" />
            </NavLink>
          )}
        </nav>

        {/* Logout */}
        <div className="px-2 pb-4">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors",
              !sidebarOpen && "justify-center px-2",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-border flex items-center justify-end px-6 gap-4 shrink-0 bg-card">
          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
            </Button>
            {notifications > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {notifications}
              </span>
            )}
          </div>
          {/* Avatar */}
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
            {(localStorage.getItem("studyPlannerEmail") ?? "A")[0].toUpperCase()}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
