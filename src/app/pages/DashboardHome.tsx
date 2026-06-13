import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  BookMarked,
  BookCheck,
  Award,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { loadLocal, LS_COURSES, type Course } from "../lib/api";

const CATEGORY_COLORS = ["#4169E1", "#2ecc71", "#e67e22", "#9b59b6", "#1abc9c"];

export function DashboardHome() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    setCourses(loadLocal<Course>(LS_COURSES));
  }, []);

  const ongoing = courses.filter((c) => c.status === "in-progress" || c.status === "enrolled");
  const completed = courses.filter((c) => c.status === "completed");
  const certifications = courses.filter((c) => c.hasCertificate).length;

  // Category breakdown for pie chart
  const categoryMap: Record<string, number> = {};
  for (const c of courses) {
    const cat = c.category ?? "Other";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
  }
  const pieData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  const statCards = [
    {
      label: "Ongoing Courses",
      value: ongoing.length,
      sub: "Active Courses",
      icon: BookMarked,
      color: "text-primary",
    },
    {
      label: "Completed Courses",
      value: completed.length,
      sub: "Courses Finished",
      icon: BookCheck,
      color: "text-green-400",
    },
    {
      label: "Certificates Earned",
      value: certifications,
      sub: "Certificates Collected",
      icon: Award,
      color: "text-yellow-400",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {localStorage.getItem("studyPlannerEmail") ?? "Admin"}
        </p>
      </div>

      {/* Stat cards + Pie chart row */}
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

        {/* Course category donut */}
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
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 8 }}
                    labelStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {pieData.length > 0 && (
              <div className="mt-2 space-y-1">
                {pieData.map(({ name, value }, i) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
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

      {/* Learning progress */}
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
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate("/admin/courses")}
              >
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
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        course.status === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : course.status === "in-progress"
                          ? "bg-primary/20 text-primary"
                          : course.status === "enrolled"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {course.status === "completed"
                        ? "Complete"
                        : course.status === "in-progress"
                        ? "In Progress"
                        : course.status === "enrolled"
                        ? "Enrolled"
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
