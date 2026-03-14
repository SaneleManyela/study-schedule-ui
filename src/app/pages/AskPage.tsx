import { useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CircleDot,
  Clock3,
  FileText,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";
import { queryResearch } from "../lib/api";
import {
  createResearchResponse,
  formatTimestamp,
  loadDocuments,
  loadQueryHistory,
  loadResearchProfile,
  loadResearchSettings,
  saveQueryHistory,
  type QueryHistoryItem,
  type ResearchResponse,
} from "../lib/workbench";

const quickQuestions = [
  "What is the central argument supported by the uploaded source?",
  "List the strongest evidence in the source without adding external claims.",
  "What limitations, contradictions, or gaps are explicitly stated in the document?",
];

export function AskPage() {
  const [documents, setDocuments] = useState(() => loadDocuments());
  const [settings, setSettings] = useState(() => loadResearchSettings());
  const [profile, setProfile] = useState(() => loadResearchProfile());
  const [history, setHistory] = useState<QueryHistoryItem[]>(() => loadQueryHistory());
  const [question, setQuestion] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([
    "Ask page ready. Submit a grounded question to query the backend.",
  ]);
  const [latestResponse, setLatestResponse] = useState<ResearchResponse | null>(
    () => loadQueryHistory()[0]?.response ?? null,
  );

  const handleAsk = async () => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      toast.error("Enter a question first");
      return;
    }

    setIsRunning(true);
    setConsoleLines([
      "[1/4] Validating research question.",
      "[2/4] Loading sources and notebook settings.",
      "[3/4] Calling FastAPI research endpoint.",
    ]);

    let response: ResearchResponse;

    try {
      response = await queryResearch({
        question: trimmedQuestion,
        documents,
        settings,
        profile,
      });
      setConsoleLines((current) => [
        "[4/4] Backend response received and rendered.",
        ...current,
      ].slice(0, 8));
    } catch (error) {
      response = createResearchResponse({
        question: trimmedQuestion,
        documents,
        settings,
        profile,
      });

      const message = error instanceof Error ? error.message : "Unknown backend error";
      setConsoleLines((current) => [
        "FastAPI unreachable. Showing local fallback response.",
        message,
        ...current,
      ].slice(0, 8));
      toast.error("Backend unavailable. Using fallback response.");
    }

    const entry: QueryHistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      question: trimmedQuestion,
      createdAt: new Date().toISOString(),
      response,
    };

    const nextHistory = [entry, ...history].slice(0, 8);
    setHistory(nextHistory);
    saveQueryHistory(nextHistory);
    setLatestResponse(response);
    setIsRunning(false);
    toast.success("Answer ready");
  };

  return (
    <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(65,105,225,0.22),transparent_34%),radial-gradient(circle_at_12%_30%,rgba(255,255,255,0.05),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_40%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-8 space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-primary/30 bg-card/75 backdrop-blur overflow-hidden">
              <CardContent className="p-8 space-y-6">
                <div className="flex flex-wrap gap-3">
                  <Badge className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/15">
                    Dedicated Q&A page
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {profile.projectTitle || "Academic Truth Engine"}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl leading-tight max-w-3xl">
                    Ask focused research questions and review grounded answers in one place.
                  </h1>
                  <p className="text-muted-foreground max-w-2xl text-base leading-7">
                    This page is a cleaner front-end for the notebook research loop. It uses the FastAPI bridge first, then falls back to a local placeholder response if the backend is offline.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-background/50 p-4">
                    <p className="text-sm text-muted-foreground">Sources available</p>
                    <p className="mt-2 text-3xl text-primary">{documents.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">PDF and Drive items from the workbench.</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/50 p-4">
                    <p className="text-sm text-muted-foreground">Model</p>
                    <p className="mt-2 text-lg text-primary break-words">{settings.preferredModel}</p>
                    <p className="text-sm text-muted-foreground mt-1">Configured in the admin page.</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/50 p-4">
                    <p className="text-sm text-muted-foreground">History</p>
                    <p className="mt-2 text-3xl text-primary">{history.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">Recent Q&A exchanges stored locally.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <BookOpenText className="h-5 w-5" />
                  Research Context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Research focus</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {profile.researchFocus || "No research focus saved yet."}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Notebook target</p>
                  <p className="mt-2 text-sm break-all leading-7 text-muted-foreground">{settings.notebookPath}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Source snapshot</p>
                  <div className="mt-3 space-y-2">
                    {documents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No source documents loaded.</p>
                    ) : (
                      documents.slice(0, 4).map((document) => (
                        <div key={document.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <FileText className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                          <span>{document.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <Card className="border-primary/25 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <MessageSquareText className="h-5 w-5" />
                  Ask a Question
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Ask a grounded question about your uploaded source material"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="min-h-[160px] bg-input border-border focus:border-primary"
                />
                <div className="flex flex-wrap gap-2">
                  {quickQuestions.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-primary/20 bg-background/40 hover:bg-primary/10 hover:text-primary"
                      onClick={() => setQuestion(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    This page uses the FastAPI backend to produce answers and keeps a local history for review.
                  </p>
                  <Button onClick={handleAsk} disabled={isRunning} className="min-w-36">
                    {isRunning ? "Asking" : "Ask now"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <Separator />

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
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-primary/25 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <BrainCircuit className="h-5 w-5" />
                    Latest Answer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {latestResponse ? (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-2xl text-primary">{latestResponse.title}</h2>
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
                    <p className="text-sm text-muted-foreground">No answer yet. Submit a question to populate this panel.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/25 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Clock3 className="h-5 w-5" />
                    Recent Questions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No question history yet.</p>
                  ) : (
                    history.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-border bg-background/35 p-4">
                        <p className="text-sm leading-6">{entry.question}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{formatTimestamp(entry.createdAt)}</span>
                        </div>
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