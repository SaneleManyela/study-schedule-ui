import { useEffect, useRef, useState } from "react";

// Extract the Google Drive file ID from a share URL.
// Returns the file ID string if the URL is a recognised Drive link, otherwise null.
function parseGdriveUrl(url: string): string | null {
  const m = /drive\.google\.com\/(?:file\/d\/|uc\?.*id=)([a-zA-Z0-9_-]+)/.exec(url);
  return m ? m[1] : null;
}

// Normalise any Google Drive URL to the embeddable /preview URL.
// The /view?usp=sharing URL is blocked by X-Frame-Options; /preview is allowed.
// Passes through data URIs and non-Drive URLs unchanged.
function normalizeGdriveContent(content: string): string {
  if (!content || content.startsWith("data:") || content.endsWith("/preview")) return content;
  const fileId = parseGdriveUrl(content);
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : content;
}

// Convert a base64 data URI to a Blob URL so browsers render PDFs inline
// instead of triggering a download prompt.
function dataUriToBlobUrl(dataUri: string): string {
  const [header, b64] = dataUri.split(",");
  const mime = header.split(":")[1].split(";")[0];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime }));
}
import { Upload, BookMarked, X, FileText, Globe, Pencil, FolderOpen } from "lucide-react";
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
  getLibraryItem,
  createLibraryItem as apiCreateLibraryItem,
  updateLibraryItem as apiUpdateLibraryItem,
  deleteLibraryItem as apiDeleteLibraryItem,
  proxyUrl,
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
  const [viewerLoading, setViewerLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Convert data URI → blob URL whenever viewerItem content changes.
  // Revoke the previous blob URL to avoid memory leaks.
  useEffect(() => {
    let url: string | null = null;
    if (viewerItem?.type === "pdf" && viewerItem.content) {
      try { url = dataUriToBlobUrl(viewerItem.content); } catch { /* invalid data URI */ }
    }
    if (viewerItem?.type === "gdrive" && viewerItem.content && viewerItem.content.startsWith("data:")) {
      try { url = dataUriToBlobUrl(viewerItem.content); } catch { /* invalid data URI */ }
    }
    setPdfBlobUrl(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [viewerItem?.content]);

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

  // edit dialog
  const [editItem, setEditItem] = useState<LibraryItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCourseId, setEditCourseId] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [editLoading, setEditLoading] = useState(false);

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
      } else if (uploadType === "gdrive") {
        if (!uploadUrl.trim()) { toast.error("Google Drive link is required."); setUploadLoading(false); return; }
        // Validate it looks like a Drive link before sending to backend
        if (!parseGdriveUrl(uploadUrl.trim())) { toast.error("Invalid Google Drive URL. Paste the share link from Google Drive."); setUploadLoading(false); return; }
        // Send the raw share URL — the backend will download the PDF and store it as base64
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
          // For gdrive items, store the preview URL so the viewer can embed it.
          // Storing the raw share URL causes X-Frame-Options blocks in the iframe.
          const fallbackContent = payload.type === "gdrive"
            ? normalizeGdriveContent(payload.content)
            : payload.content;
          newItem = { id: `${Date.now()}-${Math.random()}`, ...payload, content: fallbackContent, createdAt: now, updatedAt: now };
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

  const openViewer = async (item: LibraryItem) => {
    setViewerItem(item); // show viewer immediately with metadata
    setView("viewer");
    // Only fetch from DB when content is empty (stripped from Firestore list response).
    // Items that were saved locally already carry their full base64 content.
    if ((item.type === "pdf" || item.type === "gdrive") && !item.content) {
      setViewerLoading(true);
      try {
        const full = await getLibraryItem(item.id);
        setViewerItem(full);
      } catch {
        toast.error("Failed to load document from database.");
      } finally {
        setViewerLoading(false);
      }
    }
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

  const openEdit = async (item: LibraryItem) => {
    // For PDF items we need the full content to allow re-upload awareness
    let full = item;
    if ((item.type === "pdf" || item.type === "gdrive") && !item.content) {
      try { full = await getLibraryItem(item.id); } catch { /* fall back to stub */ }
    }
    setEditItem(full);
    setEditTitle(full.title);
    setEditCourseId(full.courseId);
    setEditUrl(full.type === "url" ? full.content : "");
    setEditFile(null);
    if (editFileRef.current) editFileRef.current.value = "";
  };

  const handleEdit = async () => {
    if (!editItem) return;
    if (!editTitle.trim()) { toast.error("Title is required."); return; }
    setEditLoading(true);
    try {
      const course = courses.find((c) => c.id === editCourseId);
      const patch: Record<string, string> = { title: editTitle.trim() };
      if (course) { patch.courseId = course.id; patch.courseName = course.name; }
      if (editItem.type === "url") {
        if (!editUrl.trim()) { toast.error("URL is required."); setEditLoading(false); return; }
        try { new URL(editUrl.trim()); } catch { toast.error("Invalid URL."); setEditLoading(false); return; }
        patch.content = editUrl.trim();
      } else if (editFile) {
        patch.content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(editFile);
        });
      }
      let updated: LibraryItem;
      if (useRemote) {
        updated = await apiUpdateLibraryItem(editItem.id, patch);
      } else {
        updated = { ...editItem, ...patch, updatedAt: new Date().toISOString() };
      }
      persist(items.map((i) => i.id === updated.id ? { ...updated, content: i.content } : i));
      toast.success("Item updated.");
      setEditItem(null);
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setEditLoading(false);
    }
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
          {viewerLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ minHeight: "70vh" }}>
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Loading from database…</p>
            </div>
          ) : viewerItem.type === "pdf" ? (
            <iframe
              src={pdfBlobUrl ?? ""}
              title={viewerItem.title}
              className="w-full h-full"
              style={{ minHeight: "70vh" }}
            />
          ) : viewerItem.type === "gdrive" ? (
            // Google Drive /preview iframes may be blocked by CSP frame-ancestors
            // when embedded from non-Google origins (including localhost).
            // We show the iframe optimistically and always surface an "Open in Drive"
            // button so the document is accessible even if the embed is blank.
            <div className="relative flex flex-col w-full h-full" style={{ minHeight: "70vh" }}>
              <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-border bg-muted/40">
                <span className="text-xs text-muted-foreground">If the preview is blank, open directly in Google Drive.</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open(normalizeGdriveContent(viewerItem.content).replace("/preview", "/view"), "_blank", "noopener,noreferrer")}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Open in Google Drive
                </Button>
              </div>
              <iframe
                src={normalizeGdriveContent(viewerItem.content)}
                title={viewerItem.title}
                className="w-full flex-1"
                style={{ minHeight: "60vh" }}
                allow="autoplay"
              />
            </div>
          ) : (
            // URL items: load through the backend proxy (strips X-Frame-Options / CSP
            // frame-ancestors).  Critically, allow-same-origin is NOT set in the sandbox
            // so that the proxied page's JavaScript runs with a null origin and cannot
            // access or navigate the parent frame.  Without this, frame-busting scripts
            // (window.top.location = ...) cause VS Code's webview — and some browsers —
            // to intercept the navigation and show their own "cannot embed" error page,
            // bypassing our app entirely.
            <div className="relative flex flex-col w-full h-full" style={{ minHeight: "70vh" }}>
              <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-border bg-muted/40">
                <span className="text-xs text-muted-foreground">If the page requires login, open it directly in your browser.</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open(viewerItem.content, "_blank", "noopener,noreferrer")}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Open in Browser
                </Button>
              </div>
              <iframe
                key={viewerItem.content}
                src={proxyUrl(viewerItem.content)}
                title={viewerItem.title}
                className="w-full flex-1"
                style={{ minHeight: "60vh" }}
                sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
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
                  <SelectItem value="gdrive">Google Drive PDF</SelectItem>
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
            ) : uploadType === "gdrive" ? (
              <div className="space-y-1.5">
                <Label className="font-semibold">Google Drive Share Link</Label>
                <Input value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} placeholder="https://drive.google.com/file/d/.../view?usp=sharing" className="bg-secondary border-border" />
                <p className="text-xs text-muted-foreground">Paste the "Share" link from Google Drive. The file must be publicly accessible (Anyone with the link).</p>
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
                          ) : item.type === "gdrive" ? (
                            <FolderOpen className="h-10 w-10 text-yellow-400/80" />
                          ) : (
                            <Globe className="h-10 w-10 text-primary/70" />
                          )}
                        </div>
                        <p className="text-xs font-medium truncate text-center">{item.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {item.type === "pdf" ? "PDF" : item.type === "gdrive" ? "Drive" : "Link"}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                              className="text-primary hover:text-primary/80"
                              aria-label="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
                              className="text-destructive hover:text-destructive/80"
                              aria-label="Delete"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
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

        {/* Edit dialog */}
        <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null); }}>
          <DialogContent className="bg-card border-border sm:max-w-md">
            <DialogHeader><DialogTitle>Edit Library Item</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label>Course</Label>
                <Select value={editCourseId} onValueChange={setEditCourseId}>
                  <SelectTrigger className="bg-secondary border-border w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editItem?.type === "url" ? (
                <div className="space-y-1.5">
                  <Label>URL</Label>
                  <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://..." className="bg-secondary border-border" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Replace PDF <span className="text-muted-foreground font-normal">(optional — leave blank to keep current)</span></Label>
                  <input
                    ref={editFileRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                  />
                  {editFile && <p className="text-xs text-muted-foreground">{editFile.name}</p>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={editLoading} className="bg-primary hover:bg-primary/80">
                {editLoading ? "Saving…" : "Save Changes"}
              </Button>
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
