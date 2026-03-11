import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  Link2,
  Mail,
  Save,
  Settings2,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatTimestamp,
  loadDocuments,
  loadResearchProfile,
  loadResearchSettings,
  saveResearchProfile,
  saveResearchSettings,
  type ResearchDocument,
  type ResearchProfile,
  type ResearchSettings,
} from "../lib/workbench";

export function AdminPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ResearchSettings>(() => loadResearchSettings());
  const [profile, setProfile] = useState<ResearchProfile>(() => loadResearchProfile());
  const [documents, setDocuments] = useState<ResearchDocument[]>([]);

  useEffect(() => {
    setDocuments(loadDocuments());
  }, []);

  const handleSave = () => {
    saveResearchSettings(settings);
    saveResearchProfile(profile);
    toast.success("Research settings saved");
  };

  const readinessLabel = useMemo(() => {
    if (!settings.replicateApiToken) {
      return "Configuration required";
    }

    if (!documents.length) {
      return "Awaiting sources";
    }

    return "Workbench ready for backend wiring";
  }, [documents.length, settings.replicateApiToken]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="hover:bg-primary/10 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-primary">Research Control Panel</h1>
              <p className="text-sm text-muted-foreground">
                Configure the notebook runtime assumptions behind the React workbench.
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card className="border-primary/30 bg-card/80 backdrop-blur overflow-hidden">
            <CardContent className="p-6 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Notebook target</p>
                <p className="mt-2 text-lg">Academic Truth Engine v2</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Store the notebook path and runtime capabilities here.
                </p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Sources queued</p>
                <p className="mt-2 text-3xl text-primary">{documents.length}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  PDFs and Drive links captured in the workbench.
                </p>
              </div>
              <div className="flex flex-col justify-between gap-3">
                <Badge className="w-fit bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">
                  {readinessLabel}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  React now models the workflow, but Python still has to execute the actual research pipeline.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Settings2 className="h-5 w-5" />
                Engine Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="replicateApiToken" className="text-foreground">
                  Replicate API Token
                </Label>
                <Input
                  id="replicateApiToken"
                  type="password"
                  placeholder="Enter REPLICATE_API_TOKEN"
                  value={settings.replicateApiToken}
                  onChange={(e) =>
                    setSettings({ ...settings, replicateApiToken: e.target.value })
                  }
                  className="bg-input border-border focus:border-primary font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  This matches the notebook setup required in Step 2.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredModel">Granite Model</Label>
                  <Input
                    id="preferredModel"
                    value={settings.preferredModel}
                    onChange={(e) =>
                      setSettings({ ...settings, preferredModel: e.target.value })
                    }
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notebookPath">Notebook Path</Label>
                  <Input
                    id="notebookPath"
                    value={settings.notebookPath}
                    onChange={(e) =>
                      setSettings({ ...settings, notebookPath: e.target.value })
                    }
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid gap-4 rounded-xl border border-border bg-background/40 p-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="enableOcrFallback">OCR fallback</Label>
                    <Switch
                      id="enableOcrFallback"
                      checked={settings.enableOcrFallback}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, enableOcrFallback: checked })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used when the notebook must OCR image-based PDFs.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="tesseractReady">Tesseract ready</Label>
                    <Switch
                      id="tesseractReady"
                      checked={settings.tesseractReady}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, tesseractReady: checked })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required for OCR extraction on Windows.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="popplerReady">Poppler ready</Label>
                    <Switch
                      id="popplerReady"
                      checked={settings.popplerReady}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, popplerReady: checked })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Needed for PDF-to-image conversion during OCR fallback.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <User className="h-5 w-5" />
                Research Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="organization" className="text-foreground">
                    Organization
                  </Label>
                  <Input
                    id="organization"
                    placeholder="School or institution"
                    value={profile.organization}
                    onChange={(e) =>
                      setProfile({ ...profile, organization: e.target.value })
                    }
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectTitle" className="text-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Project Title
                  </Label>
                  <Input
                    id="projectTitle"
                    placeholder="Assignment or research project"
                    value={profile.projectTitle}
                    onChange={(e) =>
                      setProfile({ ...profile, projectTitle: e.target.value })
                    }
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="researchFocus" className="text-foreground">
                  Research Focus
                </Label>
                <Input
                  id="researchFocus"
                  placeholder="Example: compare two theories using grounded evidence"
                  value={profile.researchFocus}
                  onChange={(e) =>
                    setProfile({ ...profile, researchFocus: e.target.value })
                  }
                  className="bg-input border-border focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-foreground">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Rubric constraints, deployment notes, or citation requirements..."
                  value={profile.notes}
                  onChange={(e) =>
                    setProfile({ ...profile, notes: e.target.value })
                  }
                  className="bg-input border-border focus:border-primary min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
                Source Registry ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sources added from the workbench yet</p>
                  <Button
                    variant="outline"
                    className="mt-4 border-primary/30 hover:bg-primary/10 hover:text-primary hover:border-primary"
                    onClick={() => navigate("/")}
                  >
                    Open Workbench
                  </Button>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/70 border-border">
                        <TableHead className="text-primary">Type</TableHead>
                        <TableHead className="text-primary">Source Name</TableHead>
                        <TableHead className="text-primary">Captured</TableHead>
                        <TableHead className="text-primary">Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow
                          key={doc.id}
                          className="hover:bg-primary/5 border-border"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {doc.type === "file" ? (
                                <div className="p-1.5 rounded bg-primary/10">
                                  <FileText className="h-4 w-4 text-primary" />
                                </div>
                              ) : (
                                <div className="p-1.5 rounded bg-primary/10">
                                  <Link2 className="h-4 w-4 text-primary" />
                                </div>
                              )}
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                {doc.type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{doc.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatTimestamp(doc.uploadedAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {doc.type === "link" ? (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline truncate block max-w-xs"
                              >
                                {doc.url}
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">Local file</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
