import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
} from "@mui/material";
import { BookmarkAdd } from "@mui/icons-material";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  loadLocal,
  saveLocal,
  LS_COURSES,
  listCourses,
  createCourse as apiCreateCourse,
  updateCourse as apiUpdateCourse,
  deleteCourse as apiDeleteCourse,
  type Course,
  type CourseStatus,
  type CreateCoursePayload,
} from "../lib/api";
import { toast } from "sonner";

const CATEGORIES = ["Programming", "Design & UI/UX", "Business & Marketing", "Data Science & AI", "Language", "Other"];
const STATUS_OPTIONS: { value: CourseStatus; label: string }[] = [
  { value: "shelf", label: "Shelf" },
  { value: "enrolled", label: "Enrolled" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const MUI_PAPER_SX = {
  background: "#0a0a0a",
  border: "1px solid #2a2a2a",
  borderRadius: 2,
};

const MUI_CELL_SX = { color: "#fff", borderBottom: "1px solid #2a2a2a" };
const MUI_HEAD_SX = { color: "#a0a0a0", borderBottom: "1px solid #2a2a2a", fontWeight: 600 };

function StatusBadge({ status }: { status: CourseStatus }) {
  const map: Record<CourseStatus, { label: string; cls: string }> = {
    "shelf": { label: "Shelf", cls: "bg-secondary text-muted-foreground" },
    "enrolled": { label: "Enrolled", cls: "bg-yellow-500/20 text-yellow-400" },
    "in-progress": { label: "In Progress", cls: "bg-primary/20 text-primary" },
    "completed": { label: "Complete", cls: "bg-green-500/20 text-green-400" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
  );
}

type DialogMode = "add" | "edit";

export function CourseOverviewPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("add");
  const [editTarget, setEditTarget] = useState<Course | null>(null);

  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState<CourseStatus>("shelf");
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formCertificate, setFormCertificate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [useRemote, setUseRemote] = useState(true);

  useEffect(() => {
    listCourses()
      .then((data) => { setCourses(data); saveLocal(LS_COURSES, data); })
      .catch(() => { setCourses(loadLocal<Course>(LS_COURSES)); setUseRemote(false); });
  }, []);

  const persist = (next: Course[]) => {
    setCourses(next);
    saveLocal(LS_COURSES, next);
  };

  const syncRemote = async (action: () => Promise<void>, fallback: () => void) => {
    if (!useRemote) { fallback(); return; }
    try { await action(); } catch { fallback(); setUseRemote(false); }
  };

  const activeCourses = courses.filter((c) => c.status !== "completed");
  const doneCourses = courses.filter((c) => c.status === "completed");

  const openAdd = () => {
    setDialogMode("add");
    setEditTarget(null);
    setFormName("");
    setFormStatus("shelf");
    setFormCategory(CATEGORIES[0]);
    setFormCertificate(false);
    setDialogOpen(true);
  };

  const openEdit = (course: Course) => {
    setDialogMode("edit");
    setEditTarget(course);
    setFormName(course.name);
    setFormStatus(course.status);
    setFormCategory(course.category ?? CATEGORIES[0]);
    setFormCertificate(course.hasCertificate ?? false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Course name is required.");
      return;
    }
    const now = new Date().toISOString();
    if (dialogMode === "add") {
      const payload: CreateCoursePayload = { name: formName.trim(), status: formStatus, category: formCategory, hasCertificate: formCertificate };
      const localCourse: Course = { id: `${Date.now()}-${Math.random()}`, ...payload, createdAt: now, updatedAt: now };
      await syncRemote(
        async () => {
          const created = await apiCreateCourse(payload);
          persist([created, ...courses]);
        },
        () => persist([localCourse, ...courses]),
      );
      toast.success("Course added.");
    } else if (editTarget) {
      const patch = { name: formName.trim(), status: formStatus, category: formCategory, hasCertificate: formCertificate };
      const localUpdated = courses.map((c) =>
        c.id === editTarget.id ? { ...c, ...patch, updatedAt: now } : c,
      );
      await syncRemote(
        async () => {
          await apiUpdateCourse(editTarget.id, patch);
          const refreshed = await listCourses();
          persist(refreshed);
        },
        () => persist(localUpdated),
      );
      toast.success("Course updated.");
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!selectedId) {
      toast.error("Select a course row first.");
      return;
    }
    const next = courses.filter((c) => c.id !== selectedId);
    await syncRemote(
      async () => { await apiDeleteCourse(selectedId); persist(next); },
      () => persist(next),
    );
    setSelectedId(null);
    toast.success("Course deleted.");
  };

  const handleEnroll = async (course: Course) => {
    const now = new Date().toISOString();
    const updated = courses.map((c) =>
      c.id === course.id ? { ...c, status: "enrolled" as CourseStatus, updatedAt: now } : c,
    );
    await syncRemote(
      async () => { await apiUpdateCourse(course.id, { status: "enrolled" }); persist(updated); },
      () => persist(updated),
    );
    toast.success(`Enrolled in "${course.name}".`);
  };

  const CourseTable = ({ rows, title }: { rows: Course[]; title: string }) => (
    <div>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <TableContainer component={Paper} sx={MUI_PAPER_SX}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={MUI_HEAD_SX}>Course</TableCell>
              <TableCell sx={MUI_HEAD_SX}>Status</TableCell>
              <TableCell sx={MUI_HEAD_SX}>Certificate</TableCell>
              <TableCell sx={MUI_HEAD_SX} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ ...MUI_CELL_SX, color: "#a0a0a0", textAlign: "center", py: 3 }}>
                  No courses in this list.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((course) => (
                <TableRow
                  key={course.id}
                  selected={course.id === selectedId}
                  onClick={() => setSelectedId(course.id)}
                  sx={{
                    cursor: "pointer",
                    background: course.id === selectedId ? "rgba(65,105,225,0.12)" : "transparent",
                    "&:hover": { background: "rgba(65,105,225,0.07)" },
                  }}
                >
                  <TableCell sx={MUI_CELL_SX}>
                    <button
                      className="text-primary hover:underline font-medium text-left"
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/courses/${course.id}`); }}
                    >
                      {course.name}
                    </button>
                  </TableCell>
                  <TableCell sx={MUI_CELL_SX}>
                    <StatusBadge status={course.status} />
                  </TableCell>
                  <TableCell sx={MUI_CELL_SX}>
                    {course.hasCertificate
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">Yes</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">No</span>}
                  </TableCell>
                  <TableCell sx={MUI_CELL_SX} align="right">
                    <Tooltip title="Enroll" arrow>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleEnroll(course); }}
                        sx={{ color: "#4169E1" }}
                        disabled={course.status === "completed" || course.status === "enrolled" || course.status === "in-progress"}
                      >
                        <BookmarkAdd fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View" arrow>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/courses/${course.id}`); }}
                        sx={{ color: "#a0a0a0" }}
                      >
                        <BookOpen className="h-4 w-4" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Course Overview</h1>
        <p className="text-muted-foreground mt-1">Manage your enrolled and completed courses.</p>
      </div>

      {/* Action buttons – 1.5rem (mb-6) spacing above table */}
      <div className="flex gap-2 mb-6">
        <Button onClick={openAdd} className="gap-2 bg-primary hover:bg-primary/80">
          <Plus className="h-4 w-4" />
          Add
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            if (!selectedId) { toast.error("Select a course row first."); return; }
            const c = courses.find((x) => x.id === selectedId);
            if (c) openEdit(c);
          }}
        >
          <Pencil className="h-4 w-4" />
          Update
        </Button>
        <Button variant="destructive" className="gap-2" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Active courses table */}
      <CourseTable rows={activeCourses} title="Active Courses" />

      {/* Completed courses table */}
      <div className="mt-10">
        <CourseTable rows={doneCourses} title="Completed Courses" />
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === "add" ? "Add Course" : "Update Course"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Course Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Python Essentials"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as CourseStatus)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Certificate</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormCertificate(true)}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors",
                    formCertificate
                      ? "bg-primary border-primary text-white"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setFormCertificate(false)}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors",
                    !formCertificate
                      ? "bg-primary border-primary text-white"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  No
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/80">
              {dialogMode === "add" ? "Add Course" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
