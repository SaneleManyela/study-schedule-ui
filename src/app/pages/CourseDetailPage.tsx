import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@mui/material";
import { FileText, Globe, ArrowLeft, BookMarked } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  loadLocal,
  saveLocal,
  LS_COURSES,
  LS_LIBRARY,
  type Course,
  type CourseStatus,
  type LibraryItem,
} from "../lib/api";
import { cn } from "../components/ui/utils";

const STATUS_MAP: Record<CourseStatus, { label: string; cls: string }> = {
  shelf: { label: "On the Shelf", cls: "bg-secondary text-muted-foreground" },
  enrolled: { label: "Enrolled", cls: "bg-yellow-500/20 text-yellow-400" },
  "in-progress": { label: "Studying / In Progress", cls: "bg-primary/20 text-primary" },
  completed: { label: "Completed", cls: "bg-green-500/20 text-green-400" },
};

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [viewerItem, setViewerItem] = useState<LibraryItem | null>(null);

  useEffect(() => {
    const courses = loadLocal<Course>(LS_COURSES);
    const found = courses.find((c) => c.id === id) ?? null;
    setCourse(found);

    const lib = loadLocal<LibraryItem>(LS_LIBRARY);
    setLibraryItems(lib.filter((item) => item.courseId === id));
  }, [id]);

  if (!course) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Course not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/courses")}>
          Back to Courses
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[course.status];

  if (viewerItem) {
    return (
      <div className="flex flex-col h-full space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{viewerItem.title}</h1>
            <p className="text-muted-foreground text-sm">{course.name}</p>
          </div>
          <Button variant="outline" onClick={() => setViewerItem(null)}>← Back to Course</Button>
        </div>
        <div className="flex-1 rounded-xl overflow-hidden border border-border" style={{ minHeight: "70vh" }}>
          {viewerItem.type === "pdf" ? (
            <iframe
              src={viewerItem.content}
              title={viewerItem.title}
              className="w-full h-full"
              style={{ minHeight: "70vh" }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center" style={{ minHeight: "70vh" }}>
              <Globe className="h-16 w-16 text-primary/50" />
              <div>
                <p className="text-lg font-semibold">{viewerItem.title}</p>
                <p className="text-muted-foreground text-sm mt-1 break-all max-w-xl">{viewerItem.content}</p>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                External websites cannot be embedded due to browser security restrictions.
              </p>
              <Button
                className="bg-primary hover:bg-primary/80 gap-2"
                onClick={() => window.open(viewerItem.content, "_blank", "noopener,noreferrer")}
              >
                <Globe className="h-4 w-4" />
                Open in new tab
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back button */}
      <Button variant="ghost" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/admin/courses")}>
        <ArrowLeft className="h-4 w-4" />
        Back to Courses
      </Button>

      {/* Course info */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{course.name}</h1>
          {course.category && (
            <p className="text-muted-foreground mt-1">{course.category}</p>
          )}
          <div className="mt-3">
            <span className={cn("text-sm px-3 py-1 rounded-full font-medium", statusInfo.cls)}>
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Course materials – 4×4 MUI cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Course Materials</h2>
        {libraryItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-xl border border-border bg-card">
            <BookMarked className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No materials uploaded for this course yet.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/admin/library")}
            >
              Go to Library to upload
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {libraryItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setViewerItem(item)}
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 12,
                  cursor: "pointer",
                  padding: "16px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  transition: "border-color 0.15s, background 0.15s",
                }}
                className="hover:border-primary/60 hover:bg-primary/5 group transition-all"
              >
                <div style={{ height: 48, width: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.type === "pdf" ? (
                    <FileText className="h-10 w-10 text-primary/70" />
                  ) : (
                    <Globe className="h-10 w-10 text-primary/70" />
                  )}
                </div>
                <p className="text-xs font-medium text-center truncate w-full text-white">{item.title}</p>
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    color: "#a0a0a0",
                    letterSpacing: "0.05em",
                  }}
                >
                  {item.type === "pdf" ? "PDF" : "Link"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
