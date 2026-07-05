import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, BookOpen, Tag, FileText, Link2, HardDrive, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  loadLocal,
  LS_COURSES,
  LS_LIBRARY,
  listCourses,
  listLibraryItems,
  type Course,
  type LibraryItem,
  type LibraryItemType,
} from "../lib/api";

const TYPE_ICON: Record<LibraryItemType, React.ReactNode> = {
  pdf: <HardDrive className="h-3.5 w-3.5 shrink-0 text-red-400" />,
  url: <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-400" />,
  gdrive: <FileText className="h-3.5 w-3.5 shrink-0 text-green-400" />,
};

const TYPE_LABEL: Record<LibraryItemType, string> = {
  pdf: "PDF",
  url: "Link",
  gdrive: "Google Drive",
};

const STATUS_CLS: Record<string, string> = {
  "shelf": "bg-secondary text-muted-foreground",
  "enrolled": "bg-yellow-500/20 text-yellow-400",
  "in-progress": "bg-primary/20 text-primary",
  "completed": "bg-green-500/20 text-green-400",
};

export function CategoryDetailPage() {
  const { categoryName } = useParams<{ categoryName: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(categoryName ?? "");

  const [courses, setCourses] = useState<Course[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const allCourses = loadLocal<Course>(LS_COURSES);
    const allLibrary = loadLocal<LibraryItem>(LS_LIBRARY);

    Promise.allSettled([listCourses(), listLibraryItems()]).then(([cr, lr]) => {
      const resolvedCourses = cr.status === "fulfilled" ? cr.value : allCourses;
      const resolvedLibrary = lr.status === "fulfilled" ? lr.value : allLibrary;
      setCourses(resolvedCourses.filter((c) => c.category === decodedName));
      setLibrary(resolvedLibrary);
      setLoading(false);
    });
  }, [decodedName]);

  const libraryFor = (courseId: string) =>
    library.filter((item) => item.courseId === courseId);

  const totalMaterial = courses.reduce((sum, c) => sum + libraryFor(c.id).length, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/categories")}
          className="mt-0.5 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h1 className="text-3xl font-bold">{decodedName}</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            {loading ? "Loading…" : `${courses.length} course${courses.length !== 1 ? "s" : ""} · ${totalMaterial} material item${totalMaterial !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Course list */}
      {!loading && courses.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          No courses in this category yet.{" "}
          <Link to="/admin/courses" className="text-primary underline underline-offset-2">
            Add one in Course Overview.
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {courses.map((course) => {
          const items = libraryFor(course.id);
          return (
            <div key={course.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Course header row */}
              <div
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/courses/${course.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold truncate">{course.name}</span>
                  {course.hasCertificate && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-medium shrink-0">
                      Certificate
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[course.status] ?? STATUS_CLS["shelf"]}`}>
                    {course.status.replace("-", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {items.length} material{items.length !== 1 ? "s" : ""}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              {/* Library items for this course */}
              {items.length > 0 && (
                <div className="border-t border-border divide-y divide-border">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => navigate("/admin/library")}
                    >
                      {TYPE_ICON[item.type]}
                      <span className="text-sm flex-1 truncate">{item.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                        {TYPE_LABEL[item.type]}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {items.length === 0 && (
                <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                  No library material uploaded for this course.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
