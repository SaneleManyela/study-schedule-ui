import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { Plus, Pencil, Trash2, Languages } from "lucide-react";
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
  LS_LANGUAGES,
  LANGUAGE_LEVELS,
  listLanguages,
  createLanguage as apiCreateLanguage,
  updateLanguage as apiUpdateLanguage,
  deleteLanguage as apiDeleteLanguage,
  type Language,
  type LanguageLevel,
} from "../lib/api";
import { toast } from "sonner";

const LEVEL_COLOR: Record<LanguageLevel, string> = {
  Beginner: "bg-slate-500/20 text-slate-300",
  Elementary: "bg-yellow-500/20 text-yellow-400",
  Intermediate: "bg-blue-500/20 text-blue-400",
  "Upper-Intermediate": "bg-indigo-500/20 text-indigo-400",
  Advanced: "bg-purple-500/20 text-purple-400",
  Fluent: "bg-green-500/20 text-green-400",
  Native: "bg-emerald-500/20 text-emerald-400",
};

const MUI_PAPER_SX = { background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 2 };
const MUI_CELL_SX = { color: "#fff", borderBottom: "1px solid #2a2a2a" };
const MUI_HEAD_SX = { color: "#a0a0a0", borderBottom: "1px solid #2a2a2a", fontWeight: 600 };

type DialogMode = "add" | "edit";

export function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("add");
  const [editTarget, setEditTarget] = useState<Language | null>(null);
  const [formName, setFormName] = useState("");
  const [formLevel, setFormLevel] = useState<LanguageLevel>("Beginner");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listLanguages()
      .then((data) => { setLanguages(data); saveLocal(LS_LANGUAGES, data); })
      .catch(() => setLanguages(loadLocal<Language>(LS_LANGUAGES)));
  }, []);

  const openAdd = () => {
    setDialogMode("add");
    setEditTarget(null);
    setFormName("");
    setFormLevel("Beginner");
    setDialogOpen(true);
  };

  const openEdit = (lang: Language) => {
    setDialogMode("edit");
    setEditTarget(lang);
    setFormName(lang.name);
    setFormLevel(lang.level);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmed = formName.trim();
    if (!trimmed) { toast.error("Language name is required."); return; }
    if (languages.some((l) => l.name.toLowerCase() === trimmed.toLowerCase() && l.id !== editTarget?.id)) {
      toast.error("That language is already in your list.");
      return;
    }
    setSaving(true);
    try {
      if (dialogMode === "add") {
        const created = await apiCreateLanguage(trimmed, formLevel);
        setLanguages((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Language added.");
      } else if (editTarget) {
        const updated = await apiUpdateLanguage(editTarget.id, trimmed, formLevel);
        setLanguages((prev) =>
          prev.map((l) => (l.id === editTarget.id ? updated : l))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        toast.success("Language updated.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) { toast.error("Select a language row first."); return; }
    try {
      await apiDeleteLanguage(selectedId);
      setLanguages((prev) => prev.filter((l) => l.id !== selectedId));
      setSelectedId(null);
      toast.success("Language removed.");
    } catch {
      toast.error("Failed to delete. Please try again.");
    }
  };

  // Group by level bucket for the overview cards
  const levelCounts = languages.reduce<Record<string, number>>((acc, l) => {
    acc[l.level] = (acc[l.level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Languages</h1>
        <p className="text-muted-foreground mt-1">Track the languages you are learning and your proficiency level.</p>
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
            if (!selectedId) { toast.error("Select a language row first."); return; }
            const lang = languages.find((l) => l.id === selectedId);
            if (lang) openEdit(lang);
          }}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button variant="destructive" className="gap-2" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Overview cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Overview</h2>
        {languages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No languages yet. Add one above.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {languages.map((lang) => (
              <div
                key={lang.id}
                onClick={() => setSelectedId(lang.id)}
                className={`flex flex-col gap-2 rounded-xl border p-4 cursor-pointer transition-colors text-left ${
                  lang.id === selectedId
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm truncate">{lang.name}</span>
                </div>
                <span className={`self-start text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLOR[lang.level]}`}>
                  {lang.level}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Level summary row */}
      {languages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_LEVELS.filter((l) => levelCounts[l]).map((l) => (
            <span key={l} className={`text-xs px-2.5 py-1 rounded-full font-medium ${LEVEL_COLOR[l]}`}>
              {l}: {levelCounts[l]}
            </span>
          ))}
        </div>
      )}

      {/* Management table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">All Languages</h2>
        <TableContainer component={Paper} sx={MUI_PAPER_SX}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={MUI_HEAD_SX}>Language</TableCell>
                <TableCell sx={MUI_HEAD_SX}>Proficiency</TableCell>
                <TableCell sx={MUI_HEAD_SX}>Added</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {languages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} sx={{ ...MUI_CELL_SX, color: "#a0a0a0", textAlign: "center", py: 3 }}>
                    No languages yet.
                  </TableCell>
                </TableRow>
              ) : (
                languages.map((lang) => (
                  <TableRow
                    key={lang.id}
                    selected={lang.id === selectedId}
                    onClick={() => setSelectedId(lang.id)}
                    sx={{
                      cursor: "pointer",
                      background: lang.id === selectedId ? "rgba(65,105,225,0.12)" : "transparent",
                      "&:hover": { background: "rgba(65,105,225,0.07)" },
                    }}
                  >
                    <TableCell sx={MUI_CELL_SX}>
                      <div className="flex items-center gap-2">
                        <Languages className="h-3.5 w-3.5 text-primary shrink-0" />
                        {lang.name}
                      </div>
                    </TableCell>
                    <TableCell sx={MUI_CELL_SX}>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLOR[lang.level]}`}>
                        {lang.level}
                      </span>
                    </TableCell>
                    <TableCell sx={{ ...MUI_CELL_SX, color: "#a0a0a0", fontSize: "0.75rem" }}>
                      {lang.createdAt ? new Date(lang.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogMode === "add" ? "Add Language" : "Edit Language"}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="e.g. German"
                className="bg-secondary border-border"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Proficiency Level</Label>
              <Select value={formLevel} onValueChange={(v) => setFormLevel(v as LanguageLevel)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {LANGUAGE_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/80">
              {saving ? "Saving…" : dialogMode === "add" ? "Add Language" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
