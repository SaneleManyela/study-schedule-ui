import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import {
  ArrowRight,
  BrainCircuit,
  Calendar,
  CircleDot,
  DatabaseZap,
  FileText,
  FileUp,
  Link2,
  MessageSquareText,
  Radar,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createLinkDocument,
  createResearchResponse,
  formatTimestamp,
  getNotebookStages,
  loadDocuments,
  loadQueryHistory,
  loadResearchProfile,
  loadResearchSettings,
  saveDocuments,
  saveQueryHistory,
  type QueryHistoryItem,
  type ResearchDocument,
  type ResearchResponse,
} from "../lib/workbench";
import { queryResearch } from "../lib/api";

const quickQuestions = [
  "What are the strongest evidence-backed leadership themes in the uploaded source?",
  "Summarize the document's main statistical findings with no unsupported claims.",
  "Identify contradictions or limitations mentioned in the source material.",
];

export function MainPage() {
  const [documents, setDocuments] = useState<ResearchDocument[]>(() => loadDocuments());
  const [settings, setSettings] = useState(() => loadResearchSettings());
  const [profile, setProfile] = useState(() => loadResearchProfile());
  const [history, setHistory] = useState<QueryHistoryItem[]>(() => loadQueryHistory());
  const [driveLink, setDriveLink] = useState("");
  const [question, setQuestion] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([
    "Research console initialized. Waiting for notebook inputs.",
  ]);
  const [latestResponse, setLatestResponse] = useState<ResearchResponse | null>(
    () => loadQueryHistory()[0]?.response ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateDocuments = (nextDocuments: ResearchDocument[]) => {
    setDocuments(nextDocuments);
    saveDocuments(nextDocuments);
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    const newDocs: ResearchDocument[] = [];
    Array.from(files).forEach((file) => {
      if (file.type === "application/pdf") {
        const doc: ResearchDocument = {
          id: `${Date.now()}-${Math.random()}`,
          name: file.name,
          type: "file",
          url: URL.createObjectURL(file),
          uploadedAt: new Date().toISOString(),
        };
        newDocs.push(doc);
      } else {
        toast.error(`${file.name} is not a PDF file`);
      }
    });

    if (newDocs.length > 0) {
      updateDocuments([...documents, ...newDocs]);
      setConsoleLines((current) => [
        `Ingestion queue updated with ${newDocs.length} new PDF source${newDocs.length === 1 ? "" : "s"}.`,
        ...current,
      ].slice(0, 8));
      toast.success(`${newDocs.length} source${newDocs.length === 1 ? "" : "s"} uploaded`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleAddDriveLink = () => {
    if (!driveLink.trim()) {
      toast.error("Please enter a Google Drive link");
      return;
    }

    const doc = createLinkDocument(driveLink.trim());

    updateDocuments([...documents, doc]);
    setDriveLink("");
    setConsoleLines((current) => [`Drive source registered: ${doc.name}.`, ...current].slice(0, 8));
    toast.success("Drive link added to source queue");
  };

  const handleDeleteDocument = (id: string) => {
    updateDocuments(documents.filter((doc) => doc.id !== id));
    toast.success("Source removed");
  };

  const runResearchQuery = async () => {
    if (!question.trim()) {
      toast.error("Enter a research question first");
      return;
    }

    setIsRunning(true);
    setConsoleLines([
      "[1/4] Validating notebook inputs and environment settings.",
      "[2/4] Sending request to FastAPI backend.",
    ]);

    let response: ResearchResponse;

    try {
      response = await queryResearch({
        question: question.trim(),
        documents,
        settings,
        profile,
      });
      setConsoleLines((current) => [
        "[3/4] FastAPI response received.",
        "[4/4] Rendering grounded response packet.",
        ...current,
      ].slice(0, 8));
    } catch (error) {
      response = createResearchResponse({
        question: question.trim(),
        documents,
        settings,
        profile,
      });

      const message = error instanceof Error ? error.message : "Unknown backend error";
      setConsoleLines((current) => [
        "FastAPI is unreachable, using local fallback response.",
        message,
        ...current,
      ].slice(0, 8));
      toast.error("FastAPI request failed. Showing local fallback response.");
    }

    const entry: QueryHistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      question: question.trim(),
      createdAt: new Date().toISOString(),
      response,
    };

    const nextHistory = [entry, ...history].slice(0, 6);
    setHistory(nextHistory);
    saveQueryHistory(nextHistory);
    setLatestResponse(response);
    setConsoleLines((current) => [response.title, ...current].slice(0, 8));
    setIsRunning(false);
    toast.success("Question processed through workbench");
  };

  const stages = getNotebookStages({
    documents,
    settings,
    queryHistory: history,
  });
  const readiness = Math.round(
    stages.reduce((sum, stage) => sum + stage.completion, 0) / stages.length,
  );
  const readyCount = stages.filter((stage) => stage.status === "ready").length;

  return (
    <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(65,105,225,0.24),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(28,94,172,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-8 space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
            <Card className="border-primary/30 bg-card/75 backdrop-blur overflow-hidden">
              <CardContent className="p-8 space-y-6">
                <div className="flex flex-wrap gap-3">
                  <Badge className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/15">
                    Notebook-to-GUI workbench
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {profile.projectTitle || "Academic Truth Engine"}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl leading-tight max-w-3xl">
                    Turn the academic notebook into a usable research interface without losing the pipeline structure.
                  </h1>
                  <p className="text-muted-foreground max-w-2xl text-base leading-7">
                    The UI now follows the notebook flow: configuration, ingestion, semantic preparation, fusion retrieval, and the final research loop. React handles orchestration and state; Python still has to run the grounded analysis.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-background/50 p-4">
                    <p className="text-sm text-muted-foreground">Readiness</p>
                    <p className="mt-2 text-3xl text-primary">{readiness}%</p>
                    <p className="text-sm text-muted-foreground mt-1">{readyCount} of {stages.length} steps marked ready.</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/50 p-4">
                    <p className="text-sm text-muted-foreground">Sources</p>
                    <p className="mt-2 text-3xl text-primary">{documents.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">PDF uploads and shared Drive links in queue.</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/50 p-4">
                    <p className="text-sm text-muted-foreground">Queries logged</p>
                    <p className="mt-2 text-3xl text-primary">{history.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">Recent prompts captured for backend execution.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Radar className="h-5 w-5" />
                  Notebook Command Deck
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border bg-background/40 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Granite model</span>
                    <span className="text-sm">{settings.preferredModel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Replicate token</span>
                    <Badge variant={settings.replicateApiToken ? "default" : "outline"}>
                      {settings.replicateApiToken ? "Configured" : "Missing"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">OCR fallback</span>
                    <Badge variant={settings.enableOcrFallback ? "default" : "outline"}>
                      {settings.enableOcrFallback ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Notebook path</p>
                  <p className="mt-2 break-all text-sm leading-6">{settings.notebookPath}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Research focus</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {profile.researchFocus || "Add your assignment or research focus in the admin panel."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <Card className="border-primary/25 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <DatabaseZap className="h-5 w-5" />
                    Step 3: Source Intake
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={[
                      "rounded-3xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200",
                      isDragging
                        ? "border-primary bg-primary/10 scale-[1.01]"
                        : "border-border bg-background/40 hover:border-primary/50 hover:bg-background/60",
                    ].join(" ")}
                  >
                    <FileUp className={[
                      "mx-auto h-14 w-14 mb-4",
                      isDragging ? "text-primary animate-bounce" : "text-muted-foreground",
                    ].join(" ")} />
                    <p className="text-lg">
                      {isDragging ? "Drop research PDFs here" : "Drag PDF sources here or click to browse"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      These files become the notebook input for extraction, OCR fallback, and chunking.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Paste Google Drive shared link"
                        value={driveLink}
                        onChange={(e) => setDriveLink(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddDriveLink()}
                        className="pl-9 bg-input border-border focus:border-primary"
                      />
                    </div>
                    <Button onClick={handleAddDriveLink} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      Add source
                    </Button>
                  </div>

                  {documents.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-background/30 p-8 text-center text-muted-foreground">
                      <FileText className="mx-auto mb-3 h-10 w-10 opacity-60" />
                      No source material queued yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {documents.map((doc) => (
                        <Card key={doc.id} className="group border-border bg-background/40">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="rounded-xl bg-primary/10 p-2">
                                  {doc.type === "file" ? (
                                    <FileText className="h-5 w-5 text-primary" />
                                  ) : (
                                    <Link2 className="h-5 w-5 text-primary" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{doc.name}</p>
                                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatTimestamp(doc.uploadedAt)}</span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            {doc.type === "link" ? (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate text-xs text-primary hover:underline"
                              >
                                {doc.url}
                              </a>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full border-primary/30 hover:border-primary hover:bg-primary/10 hover:text-primary"
                              onClick={() => window.open(doc.url, "_blank")}
                            >
                              View source
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/25 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <MessageSquareText className="h-5 w-5" />
                    Step 6: Research Loop
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Ask a grounded question about the uploaded source material"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="min-h-[130px] bg-input border-border focus:border-primary"
                  />
                  <div className="flex flex-wrap gap-2">
                    {quickQuestions.map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-primary/20 bg-background/40 hover:bg-primary/10 hover:text-primary"
                        onClick={() => setQuestion(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      This button now packages the notebook inputs in the GUI. A Python service still has to execute the real answer.
                    </p>
                    <Button onClick={runResearchQuery} disabled={isRunning} className="min-w-36">
                      {isRunning ? "Preparing" : "Ask notebook"}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>

                  <Separator />

                  <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="rounded-2xl border border-border bg-background/35 p-4">
                      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Execution console</p>
                      <div className="mt-4 space-y-3">
                        {consoleLines.map((line) => (
                          <div key={line} className="flex items-start gap-2 text-sm">
                            <CircleDot className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                            <span className="text-muted-foreground">{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background/35 p-4 min-h-[220px]">
                      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Latest response</p>
                      {latestResponse ? (
                        <div className="mt-4 space-y-4">
                          <div>
                            <h3 className="text-xl text-primary">{latestResponse.title}</h3>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">{latestResponse.summary}</p>
                          </div>
                          <div className="space-y-2">
                            {latestResponse.evidence.map((item) => (
                              <div key={item} className="flex gap-2 text-sm text-muted-foreground">
                                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                            {latestResponse.nextAction}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-6 text-sm text-muted-foreground">
                          Submit a question to create the first GUI-side notebook handoff packet.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-primary/25 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <BrainCircuit className="h-5 w-5" />
                    Notebook Pipeline Mirror
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stages.map((stage) => (
                    <div key={stage.id} className="rounded-2xl border border-border bg-background/35 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3>{stage.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{stage.description}</p>
                        </div>
                        <Badge
                          variant={stage.status === "ready" ? "default" : stage.status === "attention" ? "secondary" : "outline"}
                          className={stage.status === "attention" ? "bg-primary/10 text-primary border-primary/20" : ""}
                        >
                          {stage.status}
                        </Badge>
                      </div>
                      <Progress value={stage.completion} />
                      <p className="text-sm text-muted-foreground">{stage.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-primary/25 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <FileText className="h-5 w-5" />
                    Query History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No questions logged yet.</p>
                  ) : (
                    history.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-border bg-background/35 p-4">
                        <p className="text-sm leading-6">{entry.question}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{formatTimestamp(entry.createdAt)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
  );
}
