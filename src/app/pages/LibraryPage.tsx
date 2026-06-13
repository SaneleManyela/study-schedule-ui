import { useEffect, useRef, useState } from "react";
import { Upload, BookMarked, X, ExternalLink, FileText, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
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
  LS_LIBRARY,
  listCourses,
  listLibraryItems,
  createLibraryItem as apiCreateLibraryItem,
  deleteLibraryItem as apiDeleteLibraryItem,
  type Course,
  type LibraryItem,
  type LibraryItemType,
} from "../lib/api";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";

type View = "home" | "upload" | "shelves" | "viewer";

export function LibraryPage() {
  const [view, setView] = useState<View>("home");
  const [courses, setCourses] = useState<Course[]>([]);
  const [items, setItems] = useState<LibraryItem[]>(() => loadLocal<LibraryItem>(LS_LIBRARY));
  const [viewerItem, setViewerItem] = useState<LibraryItem | null>(null);

  // upload form
  const [uploadCourseId, setUploadCourseId] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState<LibraryItemType>("pdf");
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [useRemote, setUseRemote] = useState(true);

  useEffect(() => {
    listCourses()
      .then((data) => { setCourses(data); saveLocal(LS_COURSES, data); if (data.length > 0) setUploadCourseId(data[0].id); })
      .catch(() => { const loaded = loadLocal<Course>(LS_COURSES); setCourses(loaded); if (loaded.length > 0) setUploadCourseId(loaded[0].id); setUseRemote(false); });
    listLibraryItems()
      .then((data) => { setItems(data); saveLocal(LS_LIBRARY, data); })
      .catch(() => { setUseRemote(false); });
  }, []);

  const persist = (next: LibraryItem[]) => {
    setItems(next);
    saveLocal(LS_LIBRARY, next);
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) { toast.error("Title is required."); return; }
    if (!uploadCourseId) { toast.error("Select a course."); return; }
    const course = courses.find((c) => c.id === uploadCourseId);
    if (!course) return;

    setUploadLoading(true);
    try {
      let content = "";
      if (uploadType === "url") {
        if (!uploadUrl.trim()) { toast.error("URL is required."); setUploadLoading(false); return; }
        // basic URL validation
        try { new URL(uploadUrl.trim()); } catch { toast.error("Invalid URL."); setUploadLoading(false); return; }
        content = uploadUrl.trim();
      } else {
        // PDF upload → base64
        if (!uploadFile) { toast.error("Select a PDF file."); setUploadLoading(false); return; }
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(uploadFile);
        });
      }
      const payload = {
        courseId: uploadCourseId,
        courseName: course.name,
        title: uploadTitle.trim(),
        type: uploadType,
        content,
      };
      let newItem: LibraryItem;
      if (useRemote) {
        try {
          newItem = await apiCreateLibraryItem(payload);
        } catch {
          setUseRemote(false);
          const now = new Date().toISOString();
          newItem = { id: `${Date.now()}-${Math.random()}`, ...payload, createdAt: now, updatedAt: now };
        }
      } else {
        const now = new Date().toISOString();
        newItem = { id: `${Date.now()}-${Math.random()}`, ...payload, createdAt: now, updatedAt: now };
      }
      persist([newItem, ...items]);
      setUploadTitle("");
      setUploadUrl("");
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Item added to library.");
      setView("shelves");
    } catch {
      toast.error("Failed to process file.");
    } finally {
      setUploadLoading(false);
    }
  };

  const openViewer = (item: LibraryItem) => {
    setViewerItem(item);
    setView("viewer");
  };

  const handleDelete = async (id: string) => {
    const next = items.filter((i) => i.id !== id);
    if (useRemote) {
      try { await apiDeleteLibraryItem(id); } catch { setUseRemote(false); }
    }
    persist(next);
    toast.success("Item removed.");
    setDeleteId(null);
  };

  // Group items by course
  const byCourse: Record<string, LibraryItem[]> = {};
  for (const item of items) {
    if (!byCourse[item.courseId]) byCourse[item.courseId] = [];
    byCourse[item.courseId].push(item);
  }

  if (view === "viewer" && viewerItem) {
    return (
      <div className="flex flex-col h-full space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{viewerItem.title}</h1>
            <p className="text-muted-foreground text-sm">{viewerItem.courseName}</p>
          </div>
          <Button variant="outline" onClick={() => setView("shelves")}>← Back to Shelves</Button>
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
              <ExternalLink className="h-16 w-16 text-primary/50" />
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
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "upload") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Upload Course Material</h1>
          <Button variant="outline" onClick={() => setView("home")}>← Back</Button>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="pt-6 space-y-5">
            {/* Course */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Course</Label>
              {courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No courses yet. Add courses in Course Overview.</p>
              ) : (
                <Select value={uploadCourseId} onValueChange={setUploadCourseId}>
                  <SelectTrigger className="bg-secondary border-border w-full">
                    <SelectValue placeholder="Select a course..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Title</Label>
              <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Chapter 1 Notes" className="bg-secondary border-border" />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Type</Label>
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as LibraryItemType)}>
                <SelectTrigger className="bg-secondary border-border w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="pdf">PDF / Book</SelectItem>
                  <SelectItem value="url">URL Link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {uploadType === "pdf" ? (
              <div className="space-y-1.5">
                <Label className="font-semibold">File (PDF)</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                />
                {uploadFile && <p className="text-xs text-muted-foreground">{uploadFile.name}</p>}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="font-semibold">URL</Label>
                <Input value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} placeholder="https://..." className="bg-secondary border-border" />
              </div>
            )}

            <Button onClick={handleUpload} disabled={uploadLoading || courses.length === 0} className="w-full bg-primary hover:bg-primary/80">
              {uploadLoading ? "Processing..." : "Add to Library"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "shelves") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Library Shelves</h1>
            <p className="text-muted-foreground text-sm mt-1">All course materials organised by course.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setView("upload")} className="gap-1.5">
              <Upload className="h-4 w-4" /> Upload
            </Button>
            <Button variant="outline" onClick={() => setView("home")}>← Back</Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No material uploaded yet.</p>
            <Button variant="outline" className="mt-4" onClick={() => setView("upload")}>Upload Material</Button>
          </div>
        ) : (
          Object.entries(byCourse).map(([courseId, courseItems]) => {
            const courseName = courseItems[0]?.courseName ?? courseId;
            return (
              <div key={courseId}>
                <h2 className="text-lg font-semibold mb-3">{courseName}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {courseItems.map((item) => (
                    <Card
                      key={item.id}
                      className={cn(
                        "border-border bg-card cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all group relative",
                      )}
                      onClick={() => openViewer(item)}
                    >
                      <CardContent className="pt-4 pb-3 px-3 flex flex-col gap-2">
                        <div className="flex items-center justify-center h-12">
                          {item.type === "pdf" ? (
                            <FileText className="h-10 w-10 text-primary/70" />
                          ) : (
                            <Globe className="h-10 w-10 text-primary/70" />
                          )}
                        </div>
                        <p className="text-xs font-medium truncate text-center">{item.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {item.type === "pdf" ? "PDF" : "Link"}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
                            className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                            aria-label="Delete"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Delete confirm dialog */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent className="bg-card border-border sm:max-w-xs">
            <DialogHeader><DialogTitle>Remove item?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will remove the item from your library. This cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Remove</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Home view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Library</h1>
        <p className="text-muted-foreground mt-1">Manage your course materials, books, and links.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
        {/* Upload card */}
        <Card
          className="border-border bg-card hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group"
          onClick={() => setView("upload")}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-primary/20 group-hover:bg-primary/30 transition-colors mb-2">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Upload Material</CardTitle>
            <CardDescription>Add a PDF book or a URL link for any course.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""} in library</p>
          </CardContent>
        </Card>

        {/* Shelves card */}
        <Card
          className="border-border bg-card hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group"
          onClick={() => setView("shelves")}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-primary/20 group-hover:bg-primary/30 transition-colors mb-2">
              <BookMarked className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Shelves</CardTitle>
            <CardDescription>Browse all uploaded material organised by course.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {Object.keys(byCourse).length} course shelf{Object.keys(byCourse).length !== 1 ? "ves" : ""}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
