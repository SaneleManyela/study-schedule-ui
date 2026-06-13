import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import {
  MenuButtonBold,
  MenuButtonItalic,
  MenuButtonUnderline,
  MenuButtonBulletedList,
  MenuButtonOrderedList,
  MenuButtonBlockquote,
  MenuButtonCode,
  MenuButtonStrikethrough,
  MenuControlsContainer,
  MenuDivider,
  MenuSelectHeading,
  RichTextEditor,
  type RichTextEditorRef,
} from "mui-tiptap";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Button } from "../components/ui/button";
import { loadLocal, LS_COURSES, getCourseNote, upsertCourseNote, type Course } from "../lib/api";

const darkTheme = createTheme({
  palette: { mode: "dark", primary: { main: "#4169E1" }, background: { paper: "#111111", default: "#000000" } },
  shape: { borderRadius: 8 },
});

const LS_NOTE_KEY = (id: string) => `study-planner-notes-${id}`;

export function CourseNotesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<RichTextEditorRef>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Load course info and note (backend first, localStorage fallback)
  useEffect(() => {
    if (!id) return;
    const courses = loadLocal<Course>(LS_COURSES);
    setCourse(courses.find((c) => c.id === id) ?? null);

    getCourseNote(id)
      .then((note) => {
        const content = note?.content ?? localStorage.getItem(LS_NOTE_KEY(id)) ?? "<p>Start writing your notes here…</p>";
        setInitialContent(content);
      })
      .catch(() => {
        const fallback = localStorage.getItem(LS_NOTE_KEY(id)) ?? "<p>Start writing your notes here…</p>";
        setInitialContent(fallback);
      });
  }, [id]);

  const doSave = useCallback(() => {
    if (!id || !editorRef.current?.editor) return;
    const html = editorRef.current.editor.getHTML();
    // Always save to localStorage as instant cache
    localStorage.setItem(LS_NOTE_KEY(id), html);
    // Persist to backend
    upsertCourseNote(id, html)
      .then(() => { setSavedAt(new Date()); setIsDirty(false); })
      .catch(() => { setSavedAt(new Date()); setIsDirty(false); }); // localStorage already saved
  }, [id]);

  const handleUpdate = useCallback(() => {
    setIsDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 800);
  }, [doSave]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      doSave();
    };
  }, [doSave]);

  // Wait for content to load before rendering editor
  if (initialContent === null) {
    return <div className="text-muted-foreground text-sm p-8">Loading notes…</div>;
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(`/admin/courses/${id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Course
          </Button>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{course?.name ?? "Notes"}</h1>
            <p className="text-muted-foreground text-sm">Course Notes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && !isDirty && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
          {isDirty && (
            <span className="text-xs text-muted-foreground italic">Saving…</span>
          )}
          <Button size="sm" onClick={doSave} className="gap-1.5 bg-primary hover:bg-primary/80">
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Editor */}
      <ThemeProvider theme={darkTheme}>
        <div
          className="flex-1 rounded-xl border border-border overflow-hidden"
          style={{ minHeight: "calc(100vh - 220px)" }}
        >
          <RichTextEditor
            ref={editorRef}
            extensions={[StarterKit, Underline]}
            content={initialContent}
            onUpdate={handleUpdate}
            renderControls={() => (
              <MenuControlsContainer>
                <MenuSelectHeading />
                <MenuDivider />
                <MenuButtonBold />
                <MenuButtonItalic />
                <MenuButtonUnderline />
                <MenuButtonStrikethrough />
                <MenuDivider />
                <MenuButtonBulletedList />
                <MenuButtonOrderedList />
                <MenuDivider />
                <MenuButtonBlockquote />
                <MenuButtonCode />
              </MenuControlsContainer>
            )}
          />
        </div>
      </ThemeProvider>
    </div>
  );
}

