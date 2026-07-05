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
} from "@mui/material";
import { Plus, Pencil, Trash2, Tag, BookOpen } from "lucide-react";
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
  loadLocal,
  saveLocal,
  LS_CATEGORIES,
  LS_COURSES,
  listCategories,
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory as apiDeleteCategory,
  type Category,
  type Course,
} from "../lib/api";
import { toast } from "sonner";

const DEFAULT_CATEGORIES: Category[] = [
  "Programming",
  "Design & UI/UX",
  "Business & Marketing",
  "Data Science & AI",
  "Language",
  "Other",
].map((name, i) => ({ id: `default-${i}`, name, createdAt: "", updatedAt: "" }));

const MUI_PAPER_SX = {
  background: "#0a0a0a",
  border: "1px solid #2a2a2a",
  borderRadius: 2,
};
const MUI_CELL_SX = { color: "#fff", borderBottom: "1px solid #2a2a2a" };
const MUI_HEAD_SX = { color: "#a0a0a0", borderBottom: "1px solid #2a2a2a", fontWeight: 600 };

type DialogMode = "add" | "edit";

export function CategoriesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("add");
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCategories()
      .then((data) => {
        if (data.length > 0) { setCategories(data); saveLocal(LS_CATEGORIES, data); }
        else {
          const stored = loadLocal<Category>(LS_CATEGORIES);
          setCategories(stored.length ? stored : DEFAULT_CATEGORIES);
        }
      })
      .catch(() => {
        const stored = loadLocal<Category>(LS_CATEGORIES);
        setCategories(stored.length ? stored : DEFAULT_CATEGORIES);
      });

    // Load courses for the "courses per category" count
    setCourses(loadLocal<Course>(LS_COURSES));
  }, []);

  const courseCountFor = (categoryName: string) =>
    courses.filter((c) => c.category === categoryName).length;

  const openAdd = () => {
    setDialogMode("add");
    setEditTarget(null);
    setFormName("");
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setDialogMode("edit");
    setEditTarget(cat);
    setFormName(cat.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmed = formName.trim();
    if (!trimmed) { toast.error("Category name is required."); return; }
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== editTarget?.id)) {
      toast.error("A category with that name already exists.");
      return;
    }
    // If the category was loaded from the offline fallback it has a fake id
    // (default-N). In that case fall back to add-then-remove so Firestore
    // gets a real document rather than saving to a non-existent path.
    const isFakeId = (id: string) => id.startsWith("default-");
    setSaving(true);
    try {
      if (dialogMode === "add") {
        const created = await apiCreateCategory(trimmed);
        setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Category added.");
      } else if (editTarget) {
        if (isFakeId(editTarget.id)) {
          // Offline fallback: create new + drop placeholder
          const created = await apiCreateCategory(trimmed);
          setCategories((prev) =>
            prev.filter((c) => c.id !== editTarget.id).concat(created)
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        } else {
          const updated = await apiUpdateCategory(editTarget.id, trimmed);
          setCategories((prev) =>
            prev.map((c) => (c.id === editTarget.id ? updated : c))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
        toast.success("Category renamed.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) { toast.error("Select a category row first."); return; }
    const cat = categories.find((c) => c.id === selectedId);
    if (!cat) return;
    const count = courseCountFor(cat.name);
    if (count > 0) {
      toast.error(`Cannot delete "${cat.name}" — ${count} course${count > 1 ? "s are" : " is"} using it.`);
      return;
    }
    try {
      // Fake IDs come from the offline fallback — no Firestore call needed.
      if (!selectedId.startsWith("default-")) {
        await apiDeleteCategory(selectedId);
      }
      setCategories((prev) => prev.filter((c) => c.id !== selectedId));
      setSelectedId(null);
      toast.success("Category deleted.");
    } catch {
      toast.error("Failed to delete. Please try again.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Course Categories</h1>
        <p className="text-muted-foreground mt-1">Manage the categories used to organise your courses.</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={openAdd} className="gap-2 bg-primary hover:bg-primary/80">
          <Plus className="h-4 w-4" />
          Add
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            if (!selectedId) { toast.error("Select a category row first."); return; }
            const cat = categories.find((c) => c.id === selectedId);
            if (cat) openEdit(cat);
          }}
        >
          <Pencil className="h-4 w-4" />
          Rename
        </Button>
        <Button variant="destructive" className="gap-2" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Category overview cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Overview</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => {
              const count = courseCountFor(cat.name);
              return (
                <button
                  key={cat.id}
                  onClick={() =>
                    cat.name === "Language"
                      ? navigate("/admin/languages")
                      : navigate(`/admin/categories/${encodeURIComponent(cat.name)}`)
                  }
                  className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 hover:bg-secondary transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5" />
                    {count} course{count !== 1 ? "s" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Management table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">All Categories</h2>
        <TableContainer component={Paper} sx={MUI_PAPER_SX}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={MUI_HEAD_SX}>Name</TableCell>
                <TableCell sx={MUI_HEAD_SX} align="right">Courses</TableCell>
                <TableCell sx={MUI_HEAD_SX}>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} sx={{ ...MUI_CELL_SX, color: "#a0a0a0", textAlign: "center", py: 3 }}>
                    No categories yet.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((cat) => (
                  <TableRow
                    key={cat.id}
                    selected={cat.id === selectedId}
                    onClick={() => setSelectedId(cat.id)}
                    onDoubleClick={() =>
                      cat.name === "Language"
                        ? navigate("/admin/languages")
                        : navigate(`/admin/categories/${encodeURIComponent(cat.name)}`)
                    }
                    sx={{
                      cursor: "pointer",
                      background: cat.id === selectedId ? "rgba(65,105,225,0.12)" : "transparent",
                      "&:hover": { background: "rgba(65,105,225,0.07)" },
                    }}
                  >
                    <TableCell sx={MUI_CELL_SX}>
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
                        {cat.name}
                      </div>
                    </TableCell>
                    <TableCell sx={MUI_CELL_SX} align="right">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                        {courseCountFor(cat.name)}
                      </span>
                    </TableCell>
                    <TableCell sx={{ ...MUI_CELL_SX, color: "#a0a0a0", fontSize: "0.75rem" }}>
                      {new Date(cat.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {/* Add / Rename dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogMode === "add" ? "Add Category" : "Rename Category"}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-1.5">
              <Label>Category Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="e.g. Cloud Computing"
                className="bg-secondary border-border"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/80">
              {saving ? "Saving…" : dialogMode === "add" ? "Add Category" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
