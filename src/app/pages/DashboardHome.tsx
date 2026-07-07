import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  BookMarked,
  BookCheck,
  Award,
  ArrowRight,
  TrendingUp,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  loadLocal,
  saveLocal,
  LS_COURSES,
  LS_CATEGORIES,
  LS_LANGUAGES,
  listCourses,
  listCategories,
  listLanguages,
  listSchedules,
  listStudyPlans,
  createCourse,
  createCategory,
  createLanguage,
  createSchedule,
  createStudyPlan,
  apiRequest,
  type Course,
  type Category,
  type Language,
  type ScheduleItem,
  type StudyPlanItem,
} from "../lib/api";
import { toast } from "sonner";

const CATEGORY_COLORS = ["#4169E1", "#2ecc71", "#e67e22", "#9b59b6", "#1abc9c"];

const LS_SCHEDULES = "study-planner-local-schedules";
const LS_PLANS = "study-planner-local-study-plans";

type SyncStatus = "idle" | "running" | "done" | "error";

interface SyncResult {
  categories: number;
  languages: number;
  courses: number;
  schedules: number;
  plans: number;
  errors: string[];
}

async function runSync(): Promise<SyncResult> {
  const result: SyncResult = { categories: 0, languages: 0, courses: 0, schedules: 0, plans: 0, errors: [] };

  try {
    const local = loadLocal<Category>(LS_CATEGORIES).filter((c) => !c.id.startsWith("default-"));
    const remote = await listCategories();
    const remoteNames = new Set(remote.map((c) => c.name.toLowerCase()));
    for (const cat of local) {
      if (!remoteNames.has(cat.name.toLowerCase())) {
        await createCategory(cat.name);
        result.categories++;
      }
    }
    const fresh = await listCategories();
    saveLocal(LS_CATEGORIES, fresh);
  } catch (e) { result.errors.push(`Categories: ${e}`); }

  try {
    const local = loadLocal<Language>(LS_LANGUAGES);
    const remote = await listLanguages();
    const remoteNames = new Set(remote.map((l) => l.name.toLowerCase()));
    for (const lang of local) {
      if (!remoteNames.has(lang.name.toLowerCase())) {
        await createLanguage(lang.name, lang.level);
        result.languages++;
      }
    }
    const fresh = await listLanguages();
    saveLocal(LS_LANGUAGES, fresh);
  } catch (e) { result.errors.push(`Languages: ${e}`); }

  try {
    const local = loadLocal<Course>(LS_COURSES);
    const remote = await listCourses();
    const remoteNames = new Set(remote.map((c) => c.name.toLowerCase()));
    for (const course of local) {
      if (!remoteNames.has(course.name.toLowerCase())) {
        await createCourse({
          name: course.name,
          status: course.status,
          category: course.category ?? undefined,
          hasCertificate: course.hasCertificate ?? false,
        });
        result.courses++;
      }
    }
    const fresh = await listCourses();
    saveLocal(LS_COURSES, fresh);
  } catch (e) { result.errors.push(`Courses: ${e}`); }

  try {
    const localOffline = loadLocal<ScheduleItem>(LS_SCHEDULES).filter((s) => s.id.includes("-"));
    const remoteSchedules = await listSchedules();
    const remoteKeys = new Set(remoteSchedules.map((s) => `${s.title}|${s.startAt}`));
    for (const s of localOffline) {
      if (!remoteKeys.has(`${s.title}|${s.startAt}`)) {
        await createSchedule({ title: s.title, description: s.description ?? "", startAt: s.startAt, endAt: s.endAt });
        result.schedules++;
      }
    }
  } catch (e) { result.errors.push(`Schedules: ${e}`); }

  try {
    const localPlans = loadLocal<StudyPlanItem>(LS_PLANS).filter((p) => p.id.includes("-"));
    const remotePlans = await listStudyPlans();
    const remoteKeys = new Set(remotePlans.map((p) => `${p.title}|${p.sessionDate}`));
    for (const p of localPlans) {
      if (!remoteKeys.has(`${p.title}|${p.sessionDate}`)) {
        await createStudyPlan({
          title: p.title,
          goal: p.goal ?? "",
          sessionDate: p.sessionDate,
          durationMinutes: p.durationMinutes ?? 60,
          notes: p.notes ?? "",
          resourceTitle: p.resourceTitle ?? undefined,
          resourceUrl: p.resourceUrl ?? undefined,
        });
        result.plans++;
      }
    }
  } catch (e) { result.errors.push(`Study Plans: ${e}`); }

  return result;
}

export function DashboardHome() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    apiRequest<Course[]>("/api/courses")
      .then(setCourses)
      .catch((error: any) => {
        setCourses(loadLocal<Course>(LS_COURSES));
        toast.error(`Learning Preference Fetch Failure: ${error.message || error}`);
      });
  }, []);

  const handleSync = async () => {
    setSyncStatus("running");
    try {
      const result = await runSync();
      setSyncResult(result);
      setSyncStatus(result.errors.length ? "error" : "done");
      const total = result.categories + result.languages + result.courses + result.schedules + result.plans;
      if (total === 0 && result.errors.length === 0) {
        toast.success("Everything is already in sync.");
      } else if (result.errors.length === 0) {
        toast.success(`Synced ${total} item${total !== 1 ? "s" : ""} to Firestore.`);
      } else {
        toast.error(`Sync completed with ${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}.`);
      }
      setCourses(loadLocal<Course>(LS_COURSES));
    } catch {
      setSyncStatus("error");
      toast.error("Sync failed. Make sure the backend is running.");
    }
  };

  const ongoing = courses.filter((c) => c.status === "in-progress" || c.status === "enrolled");
  const completed = courses.filter((c) => c.status === "completed");
  const certifications = courses.filter((c) => c.hasCertificate).length;

  const categoryMap: Record<string, number> = {};
  for (const c of courses) {
    const cat = c.category ?? "Other";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
  }
  const pieData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  const statCards = [
    { label: "Ongoing Courses", value: ongoing.length, sub: "Active Courses", icon: BookMarked, color: "text-primary" },
    { label: "Completed Courses", value: completed.length, sub: "Courses Finished", icon: BookCheck, color: "text-green-400" },
    { label: "Certificates Earned", value: certifications, sub: "Certificates Collected", icon: Award, color: "text-yellow-400" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {localStorage.getItem("studyPlannerEmail") ?? "Admin"}
        </p>
      </div>

      <Card className="border-border bg-card border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudUpload className="h-5 w-5 text-primary" />
            Sync Local Data to Firestore
          </CardTitle>
          <CardDescription>
            Push any locally stored courses, categories, languages, schedules and study plans to the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleSync}
            disabled={syncStatus === "running"}
            className="gap-2 bg-primary hover:bg-primary/80"
          >
            {syncStatus === "running" ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Syncing…</>
            ) : syncStatus === "done" ? (
              <><CheckCircle2 className="h-4 w-4" />Sync Again</>
            ) : syncStatus === "error" ? (
              <><AlertCircle className="h-4 w-4" />Retry Sync</>
            ) : (
              <><CloudUpload className="h-4 w-4" />Sync Now</>
            )}
          </Button>

          {syncResult && (
            <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm space-y-1">
              {[
                { label: "Categories", count: syncResult.categories },
                { label: "Languages", count: syncResult.languages },
                { label: "Courses", count: syncResult.courses },
                { label: "Schedules", count: syncResult.schedules },
                { label: "Study Plans", count: syncResult.plans },
              ].map(({ label, count }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={count > 0 ? "text-green-400 font-medium" : "text-muted-foreground"}>
                    {count > 0 ? `+${count} synced` : "up to date"}
                  </span>
                </div>
              ))}
              {syncResult.errors.length > 0 && (
                <div className="pt-1 border-t border-border">
                  {syncResult.errors.map((e, i) => (
                    <p key={i} className="text-red-400 text-xs">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        {statCards.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="border-border bg-card hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => navigate("/admin/courses")}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className={`text-4xl font-bold mt-1 ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </div>
                <div className={`${color} bg-secondary p-2 rounded-lg`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border-border bg-card md:row-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Course Category</CardTitle>
            <CardDescription className="text-xs">Learning Preferences</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-muted-foreground text-xs gap-2">
                <TrendingUp className="h-8 w-8 opacity-30" />
                <span>No courses yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 8 }} labelStyle={{ color: "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {pieData.length > 0 && (
              <div className="mt-2 space-y-1">
                {pieData.map(({ name, value }, i) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                      <span className="text-muted-foreground">{name}</span>
                    </div>
                    <span className="text-foreground font-medium">
                      {courses.length ? Math.round((value / courses.length) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Your Learning Progress
          </CardTitle>
          <CardDescription>Track All Your Ongoing &amp; Completed Courses</CardDescription>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <BookMarked className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No courses yet.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/courses")}>
                Add your first course
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {courses.slice(0, 5).map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-secondary/30 px-2 rounded transition-colors"
                  onClick={() => navigate(`/admin/courses/${course.id}`)}
                >
                  <div>
                    <p className="font-medium">{course.name}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{course.status.replace("-", " ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      course.status === "completed" ? "bg-green-500/20 text-green-400"
                      : course.status === "in-progress" ? "bg-primary/20 text-primary"
                      : course.status === "enrolled" ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-secondary text-muted-foreground"
                    }`}>
                      {course.status === "completed" ? "Complete"
                        : course.status === "in-progress" ? "In Progress"
                        : course.status === "enrolled" ? "Enrolled"
                        : "Shelf"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {courses.length > 5 && (
            <div className="mt-4 text-center">
              <Button variant="ghost" onClick={() => navigate("/admin/courses")} className="text-primary">
                See All Courses →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}