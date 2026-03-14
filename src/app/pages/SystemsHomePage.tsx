import { ArrowRight, BookOpenCheck, BrainCircuit, Layers3, Target } from "lucide-react";
import { useNavigate } from "react-router";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export function SystemsHomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(65,105,225,0.18),transparent_30%),radial-gradient(circle_at_85%_25%,rgba(0,153,153,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-10 space-y-8">
          <section className="space-y-4">
            <Badge className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/15">
              Two-System Application Architecture
            </Badge>
            <h1 className="text-4xl md:text-5xl leading-tight max-w-5xl">
              Choose a system: evidence-first research operations or assignment workflow excellence.
            </h1>
            <p className="text-muted-foreground text-base leading-7 max-w-3xl">
              The application is now organized as two independent but connected systems. System 1 transforms static sources into queryable research assets. System 2 orchestrates assignment production to deliver excellent final work.
            </p>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="border-primary/30 bg-card/75 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <BrainCircuit className="h-5 w-5" />
                  System 1: Evidence-First Research Pipeline
                </CardTitle>
                <CardDescription>
                  Transform static academic documents into interactive, queryable evidence sources.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background/40 p-4">
                    <p className="text-sm text-muted-foreground">Core flow</p>
                    <p className="mt-2">Source intake to retrieval prep to grounded Q and A</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-4">
                    <p className="text-sm text-muted-foreground">Primary goal</p>
                    <p className="mt-2">Evidence quality and research traceability</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigate("/research/workbench")}>
                    Open Workbench
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/research/ask")}>
                    Open Ask Interface
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/research/admin")}>
                    Open Research Admin
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-card/75 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <BookOpenCheck className="h-5 w-5" />
                  System 2: Assignment Workflow Studio
                </CardTitle>
                <CardDescription>
                  Execute assignments thoroughly, effectively, and efficiently with excellent final outputs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background/40 p-4">
                    <p className="text-sm text-muted-foreground">Core flow</p>
                    <p className="mt-2">Research setup to drafting to verification to finalization</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-4">
                    <p className="text-sm text-muted-foreground">Primary goal</p>
                    <p className="mt-2">High-quality assignment delivery</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigate("/assignment/workflow")}>
                    Open Assignment Workflow
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="border-border bg-background/40">
              <CardContent className="pt-6 flex gap-3">
                <Layers3 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p>System separation</p>
                  <p className="text-sm text-muted-foreground">Independent interfaces with clear purpose boundaries.</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-background/40">
              <CardContent className="pt-6 flex gap-3">
                <Target className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p>Outcome alignment</p>
                  <p className="text-sm text-muted-foreground">Research outputs feed higher-quality assignment execution.</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-background/40">
              <CardContent className="pt-6 flex gap-3">
                <BrainCircuit className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p>Evidence-first logic</p>
                  <p className="text-sm text-muted-foreground">Prioritize grounded claims before drafting and final review.</p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
