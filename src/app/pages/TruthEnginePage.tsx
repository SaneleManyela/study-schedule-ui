import { useMemo, useRef, useState } from "react";
import {
  Clock3,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  ListChecks,
  Mail,
  NotebookPen,
  PenSquare,
  Play,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { runWorkflow } from "../lib/api";

type WorkflowStatus = "todo" | "in-progress" | "done";

interface StepAuditEntry {
  id: string;
  createdAt: string;
  stepId: number;
  stepTitle: string;
  action: string;
  status: WorkflowStatus | "blocked";
  detail: string;
}

interface WorkflowStep {
  id: number;
  title: string;
  tool: string;
  notes: string;
}

interface ToolEntry {
  name: string;
  purpose: string;
  link: string;
  cost: string;
}

const EMAIL_KEY = "truthEngineEmail";
const EDITOR_KEY = "truthEngineDraft";
const STATUS_KEY = "truthEngineStepStatus";
const WORKFLOW_NOTES_KEY = "truthEngineWorkflowNotes";
const WORKFLOW_AUDIT_KEY = "truthEngineWorkflowAudit";

const tools: ToolEntry[] = [
  {
    name: "NotebookLM",
    purpose: "Understands assignment brief and rubric context",
    link: "https://notebooklm.google.com",
    cost: "Free",
  },
  {
    name: "Perplexity",
    purpose: "Research with cited sources",
    link: "https://perplexity.ai",
    cost: "Free",
  },
  {
    name: "Claude",
    purpose: "Builds a structured outline from research",
    link: "https://claude.ai",
    cost: "Free",
  },
  {
    name: "Ryne",
    purpose: "Final readability and style review",
    link: "https://ryne.ai",
    cost: "Free tier",
  },
  {
    name: "Citely",
    purpose: "Verifies citation validity",
    link: "https://citely.ai",
    cost: "Credit-based",
  },
  {
    name: "DripWriter",
    purpose: "Creates natural version history in Google Docs",
    link: "https://dripwriter.com",
    cost: "Free",
  },
];

const workflow: WorkflowStep[] = [
  {
    id: 1,
    title: "Upload assignment brief and rubric to NotebookLM",
    tool: "NotebookLM",
    notes: "Capture grading criteria and scope before writing.",
  },
  {
    id: 2,
    title: "Research topic in Perplexity with citations",
    tool: "Perplexity",
    notes: "Collect sources with links you can verify.",
  },
  {
    id: 3,
    title: "Use Claude for structured outline",
    tool: "Claude",
    notes: "Generate assignment structure from verified sources.",
  },
  {
    id: 4,
    title: "Write the essay draft",
    tool: "Manual writing",
    notes: "Draft in your own voice from the outline.",
  },
  {
    id: 5,
    title: "Send clean text to bolt.new custom app",
    tool: "bolt.new",
    notes: "Formatting and clean text pass.",
  },
  {
    id: 6,
    title: "Re-check with NotebookLM",
    tool: "NotebookLM",
    notes: "Evaluate alignment with brief and rubric.",
  },
  {
    id: 7,
    title: "Run Ryne review pass",
    tool: "Ryne",
    notes: "Check readability and presentation quality.",
  },
  {
    id: 8,
    title: "Validate citations with Citely",
    tool: "Citely",
    notes: "Ensure references are traceable and accurate.",
  },
  {
    id: 9,
    title: "Manually revise flagged sections",
    tool: "Manual edits",
    notes: "Fix logic, flow, and citation quality.",
  },
  {
    id: 10,
    title: "Create version history in DripWriter",
    tool: "DripWriter",
    notes: "Build timeline and finalize Google Docs history.",
  },
  {
    id: 11,
    title: "Final Ryne pass",
    tool: "Ryne",
    notes: "Last readability pass before submission.",
  },
];

const stepLinks: Record<number, string> = {
  1: "https://notebooklm.google.com",
  2: "https://perplexity.ai",
  3: "https://claude.ai",
  5: "https://bolt.new",
  6: "https://notebooklm.google.com",
  7: "https://ryne.ai",
  8: "https://citely.ai",
  10: "https://dripwriter.com",
  11: "https://ryne.ai",
};

const workflowPhases: Array<{ name: string; stepIds: number[] }> = [
  { name: "Research setup", stepIds: [1, 2, 3] },
  { name: "Draft and evaluation", stepIds: [4, 5, 6] },
  { name: "Verification and finalization", stepIds: [7, 8, 9, 10, 11] },
];

function loadEmail() {
  return localStorage.getItem(EMAIL_KEY) ?? "";
}

function loadDraft() {
  return (
    localStorage.getItem(EDITOR_KEY) ??
    "<h2>Assignment Draft</h2><p>Start writing your assignment draft here.</p>"
  );
}

function loadStepStatus() {
  const raw = localStorage.getItem(STATUS_KEY);
  if (!raw) {
    return Object.fromEntries(workflow.map((step) => [step.id, "todo"])) as Record<
      number,
      WorkflowStatus
    >;
  }

  try {
    return JSON.parse(raw) as Record<number, WorkflowStatus>;
  } catch {
    return Object.fromEntries(workflow.map((step) => [step.id, "todo"])) as Record<
      number,
      WorkflowStatus
    >;
  }
}

export function TruthEnginePage() {
  const [accountEmail, setAccountEmail] = useState(loadEmail);
  const [editorHtml, setEditorHtml] = useState(loadDraft);
  const [stepStatus, setStepStatus] = useState<Record<number, WorkflowStatus>>(loadStepStatus);
  const [workflowNotes, setWorkflowNotes] = useState<Record<number, string>>(() => {
    const raw = localStorage.getItem(WORKFLOW_NOTES_KEY);
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw) as Record<number, string>;
    } catch {
      return {};
    }
  });
  const [auditTrail, setAuditTrail] = useState<StepAuditEntry[]>(() => {
    const raw = localStorage.getItem(WORKFLOW_AUDIT_KEY);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as StepAuditEntry[];
    } catch {
      return [];
    }
  });
  const editorRef = useRef<HTMLDivElement | null>(null);

  const writeAudit = (
    stepId: number,
    action: string,
    status: WorkflowStatus | "blocked",
    detail: string,
  ) => {
    const step = workflow.find((item) => item.id === stepId);
    const entry: StepAuditEntry = {
      id: `${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
      stepId,
      stepTitle: step?.title ?? `Step ${stepId}`,
      action,
      status,
      detail,
    };
    const next = [entry, ...auditTrail].slice(0, 120);
    setAuditTrail(next);
    localStorage.setItem(WORKFLOW_AUDIT_KEY, JSON.stringify(next));
  };

  const saveEmail = () => {
    if (!accountEmail.trim()) {
      toast.error("Email is required for tool account setup");
      return;
    }

    localStorage.setItem(EMAIL_KEY, accountEmail.trim());
    toast.success("Account email saved");
  };

  const updateEditor = (html: string) => {
    setEditorHtml(html);
    localStorage.setItem(EDITOR_KEY, html);
  };

  const setStep = (id: number, status: WorkflowStatus) => {
    const next = {
      ...stepStatus,
      [id]: status,
    };
    setStepStatus(next);
    localStorage.setItem(STATUS_KEY, JSON.stringify(next));
    writeAudit(id, "manual-status-update", status, `Status changed to ${status}.`);
  };

  const runAll = async () => {
    if (!accountEmail.trim()) {
      toast.error("Add and save your email before running the workflow");
      return;
    }

    try {
      const plan = await runWorkflow(accountEmail.trim());
      const nextStatuses = { ...stepStatus };
      const nextNotes = { ...workflowNotes };

      for (const step of plan.steps) {
        if (step.id in nextStatuses) {
          if (step.status === "done" || step.status === "in-progress") {
            nextStatuses[step.id] = step.status;
          }
          nextNotes[step.id] = step.message;
          writeAudit(
            step.id,
            "workflow-run",
            step.status === "done" || step.status === "in-progress" ? step.status : "blocked",
            step.message,
          );
        }
      }

      setStepStatus(nextStatuses);
      setWorkflowNotes(nextNotes);
      localStorage.setItem(STATUS_KEY, JSON.stringify(nextStatuses));
      localStorage.setItem(WORKFLOW_NOTES_KEY, JSON.stringify(nextNotes));

      if (plan.status === "blocked") {
        writeAudit(0, "workflow-run", "blocked", plan.summary);
        toast.error(plan.summary);
        return;
      }

      toast.success("Workflow orchestration generated from FastAPI");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow service error";
      writeAudit(0, "workflow-run", "blocked", message);
      toast.error(`Workflow runner failed: ${message}`);
    }
  };

  const progress = useMemo(() => {
    const done = workflow.filter((step) => stepStatus[step.id] === "done").length;
    return Math.round((done / workflow.length) * 100);
  }, [stepStatus]);

  const applyCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      updateEditor(editorRef.current.innerHTML);
    }
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const exportDocx = async () => {
    if (!editorRef.current) {
      toast.error("Editor is not ready");
      return;
    }

    const text = editorRef.current.innerText || "";
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      toast.error("Nothing to export");
      return;
    }

    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const paragraphs = lines.map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line })],
        }),
    );

    const document = new Document({
      sections: [
        {
          children: paragraphs,
        },
      ],
    });

    const blob = await Packer.toBlob(document);
    downloadBlob(blob, "truth-engine-assignment.docx");
    toast.success("DOCX exported");
  };

  const exportPdf = () => {
    if (!editorRef.current) {
      toast.error("Editor is not ready");
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("Popup blocked. Allow popups to export PDF.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Truth Engine Export</title>
          <style>
            body { font-family: Georgia, serif; margin: 40px; color: #111; line-height: 1.6; }
            h1,h2,h3,h4 { margin-top: 24px; }
          </style>
        </head>
        <body>${editorRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const launchStepTool = (stepId: number) => {
    const url = stepLinks[stepId];
    if (!url) {
      writeAudit(stepId, "launch-tool", "blocked", "No launch URL configured.");
      toast.error("No external tool link for this step");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    setStep(stepId, "in-progress");
    writeAudit(stepId, "launch-tool", "in-progress", `Opened ${url}`);
    toast.success(`Opened step ${stepId} tool`);
  };

  const launchPhaseTools = () => {
    if (!accountEmail.trim()) {
      toast.error("Save your email first to proceed with tool accounts");
      return;
    }

    const nextPhase = workflowPhases.find((phase) =>
      phase.stepIds.some((stepId) => stepStatus[stepId] !== "done"),
    );

    if (!nextPhase) {
      toast.success("All phases are complete");
      return;
    }

    const targets = nextPhase.stepIds
      .filter((stepId) => stepStatus[stepId] !== "done")
      .map((stepId) => ({ stepId, url: stepLinks[stepId] }))
      .filter((target): target is { stepId: number; url: string } => Boolean(target.url));

    if (!targets.length) {
      toast.error(`No external links available for phase: ${nextPhase.name}`);
      return;
    }

    let blockedCount = 0;
    for (const target of targets) {
      const win = window.open(target.url, "_blank", "noopener,noreferrer");
      if (!win) {
        blockedCount += 1;
        writeAudit(target.stepId, "launch-phase-tools", "blocked", `Popup blocked for ${target.url}`);
        continue;
      }

      setStep(target.stepId, "in-progress");
      writeAudit(target.stepId, "launch-phase-tools", "in-progress", `Opened ${target.url}`);
    }

    if (blockedCount > 0) {
      toast.error(`Some popups were blocked for ${nextPhase.name}.`);
    } else {
      toast.success(`Opened tools for phase: ${nextPhase.name}`);
    }
  };

  return (
    <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(65,105,225,0.24),transparent_32%),radial-gradient(circle_at_10%_25%,rgba(255,255,255,0.06),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_46%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-8 space-y-6">
          <Card className="border-primary/30 bg-card/75 backdrop-blur overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="flex flex-wrap gap-3">
                <Badge className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/15">
                  Truth Engine
                </Badge>
                <Badge variant="outline" className="border-border text-muted-foreground">
                  Assignment Workflow
                </Badge>
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl leading-tight max-w-3xl">
                  Assignment workflow orchestration with a built-in rich text editor.
                </h1>
                <p className="text-muted-foreground max-w-3xl text-base leading-7">
                  Follow the multi-step process, keep your source quality checks in one place, and write directly inside the app. Use the tools to support planning and verification while maintaining original academic writing.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Workflow completion</p>
                  <p className="mt-2 text-3xl text-primary">{progress}%</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Tools tracked</p>
                  <p className="mt-2 text-3xl text-primary">{tools.length}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Workflow steps</p>
                  <p className="mt-2 text-3xl text-primary">{workflow.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <Card className="border-primary/25 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Mail className="h-5 w-5" />
                    Account Email Required
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Label htmlFor="accountEmail">Email for account creation across tools</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accountEmail"
                      value={accountEmail}
                      onChange={(event) => setAccountEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="bg-input border-border focus:border-primary"
                    />
                    <Button onClick={saveEmail}>Save</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/25 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <FileCheck2 className="h-5 w-5" />
                    Tool Stack
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tools.map((tool) => (
                    <div key={tool.name} className="rounded-2xl border border-border bg-background/40 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h3>{tool.name}</h3>
                        <Badge variant="outline">{tool.cost}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{tool.purpose}</p>
                      <a
                        href={tool.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Open tool
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="border-primary/25 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <ListChecks className="h-5 w-5" />
                  Assignment Workflow
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={runAll} className="bg-primary hover:bg-primary/90">
                    <Play className="h-4 w-4 mr-2" />
                    Run All Steps
                  </Button>
                  <Button variant="outline" onClick={launchPhaseTools}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Launch Phase Tools
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const reset = Object.fromEntries(
                        workflow.map((step) => [step.id, "todo"]),
                      ) as Record<number, WorkflowStatus>;
                      setStepStatus(reset);
                      localStorage.setItem(STATUS_KEY, JSON.stringify(reset));
                      writeAudit(0, "workflow-reset", "todo", "All workflow statuses reset to todo.");
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>

                <Separator />

                <div className="space-y-3">
                  {workflow.map((step) => (
                    <div key={step.id} className="rounded-2xl border border-border bg-background/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm uppercase tracking-[0.15em] text-muted-foreground">Step {step.id}</p>
                          <h3 className="mt-1">{step.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">Tool: {step.tool}</p>
                          <p className="text-sm text-muted-foreground mt-1">{step.notes}</p>
                          {workflowNotes[step.id] ? (
                            <p className="text-sm text-primary mt-2">{workflowNotes[step.id]}</p>
                          ) : null}
                        </div>
                        <Badge
                          variant={stepStatus[step.id] === "done" ? "default" : stepStatus[step.id] === "in-progress" ? "secondary" : "outline"}
                          className={stepStatus[step.id] === "in-progress" ? "bg-primary/10 text-primary border-primary/20" : ""}
                        >
                          {stepStatus[step.id]}
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => setStep(step.id, "todo")}>
                          Todo
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setStep(step.id, "in-progress")}>
                          In progress
                        </Button>
                        <Button size="sm" onClick={() => setStep(step.id, "done")}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Done
                        </Button>
                        {stepLinks[step.id] ? (
                          <Button size="sm" variant="outline" onClick={() => launchStepTool(step.id)}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            Launch tool
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-primary/25 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <NotebookPen className="h-5 w-5" />
                Rich Text Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => applyCommand("bold")}>Bold</Button>
                <Button size="sm" variant="outline" onClick={() => applyCommand("italic")}>Italic</Button>
                <Button size="sm" variant="outline" onClick={() => applyCommand("underline")}>Underline</Button>
                <Button size="sm" variant="outline" onClick={() => applyCommand("insertUnorderedList")}>Bullets</Button>
                <Button size="sm" variant="outline" onClick={() => applyCommand("insertOrderedList")}>Numbers</Button>
                <Button size="sm" variant="outline" onClick={() => applyCommand("formatBlock", "<h2>")}>H2</Button>
                <Button size="sm" variant="outline" onClick={() => applyCommand("formatBlock", "<p>")}>Paragraph</Button>
                <Button size="sm" variant="outline" onClick={() => applyCommand("removeFormat")}>Clear format</Button>
                <Button size="sm" variant="outline" onClick={exportDocx}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export DOCX
                </Button>
                <Button size="sm" variant="outline" onClick={exportPdf}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export PDF
                </Button>
              </div>

              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <PenSquare className="h-4 w-4" />
                  Autosaves in browser local storage
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-[280px] rounded-xl border border-border bg-card/60 p-4 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  dangerouslySetInnerHTML={{ __html: editorHtml }}
                  onInput={(event) => updateEditor(event.currentTarget.innerHTML)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/25 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Clock3 className="h-5 w-5" />
                Workflow Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditTrail.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit entries yet.</p>
              ) : (
                auditTrail.slice(0, 20).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border bg-background/35 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-primary">
                        Step {entry.stepId}: {entry.stepTitle}
                      </p>
                      <Badge variant="outline">{entry.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()} | action: {entry.action}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}