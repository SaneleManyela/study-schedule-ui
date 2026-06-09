import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, ListChecks, LogIn, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Calendar } from "../components/ui/calendar";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  createSchedule,
  createStudyPlan,
  listSchedules,
  listStudyPlans,
  type ScheduleItem,
  type StudyPlanItem,
} from "../lib/api";
import { toast } from "sonner";

const learningLinks = [
  {
    title: "Kaggle AI Agents Intensive",
    description: "Google vibecoding course competition and challenge materials.",
    href: "https://www.kaggle.com/competitions/5-day-ai-agents-intensive-vibecoding-course-with-google",
  },
  {
    title: "Mendix Academy",
    description: "Official Mendix learning portal and course home.",
    href: "https://academy.mendix.com/link/home",
  },
  {
    title: "Mercedes-Benz Belt Trainings",
    description: "Internal DevSecOps belt training documentation.",
    href: "https://pages.git.i.mercedes-benz.com/gcs/KnowledgeBase/devsecops_docs/Belt-Trainings/",
  },
  {
    title: "Duolingo",
    description: "Daily language practice and lesson tracking.",
    href: "https://www.duolingo.com/learn",
  },
  {
    title: "NetAcad Python Essentials 1",
    description: "Cisco Networking Academy Python fundamentals course.",
    href: "https://www.netacad.com/courses/python-essentials-1?courseLang=en-US&instance_id=6c43ad5a-403e-492e-94a1-8ef388e55e1d",
  },
  {
    title: "NetAcad Ethical Hacker",
    description: "Cisco Networking Academy ethical hacking course.",
    href: "https://www.netacad.com/courses/ethical-hacker?courseLang=en-US&instance_id=45efb141-3bf2-4e38-9074-48c22491370a",
  },
];

const LOCAL_SCHEDULES_KEY = "study-planner-local-schedules";
const LOCAL_STUDY_PLANS_KEY = "study-planner-local-study-plans";

function loadLocalItems<T>(storageKey: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function saveLocalItems<T>(storageKey: string, items: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function SystemsHomePage() {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem("studyPlannerAdmin") === "true";
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageMode, setStorageMode] = useState<"remote" | "local">("remote");
  const [loadNotice, setLoadNotice] = useState<string>("");

  const [planTitle, setPlanTitle] = useState("");
  const [planGoal, setPlanGoal] = useState("");
  const [planDate, setPlanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [planDuration, setPlanDuration] = useState("60");
  const [planNotes, setPlanNotes] = useState("");
  const [planResourceUrl, setPlanResourceUrl] = useState(learningLinks[0]?.href ?? "");
  const [linkScheduleDrafts, setLinkScheduleDrafts] = useState<Record<string, {
    date: string;
    startTime: string;
    endTime: string;
    notes: string;
  }>>(() => Object.fromEntries(
    learningLinks.map((link) => [link.href, {
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "18:00",
      endTime: "19:00",
      notes: "",
    }]),
  ));

  useEffect(() => {
    const loadPlannerData = async () => {
      try {
        const [scheduleData, planData] = await Promise.all([listSchedules(), listStudyPlans()]);
        setSchedules(scheduleData);
        setStudyPlans(planData);
        setStorageMode("remote");
        setLoadNotice("");
      } catch (error) {
        const localSchedules = loadLocalItems<ScheduleItem>(LOCAL_SCHEDULES_KEY);
        const localStudyPlans = loadLocalItems<StudyPlanItem>(LOCAL_STUDY_PLANS_KEY);
        setSchedules(localSchedules);
        setStudyPlans(localStudyPlans);
        setStorageMode("local");
        setLoadNotice("Firestore is not configured right now. The planner is using local browser storage so refresh still works on this device.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPlannerData();
  }, []);

  const selectedDayKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;

  const daySchedules = useMemo(
    () => schedules.filter((item) => item.startAt.slice(0, 10) === selectedDayKey),
    [schedules, selectedDayKey],
  );

  const dayPlans = useMemo(
    () => studyPlans.filter((item) => item.sessionDate === selectedDayKey),
    [studyPlans, selectedDayKey],
  );

  const handleCreatePlan = async () => {
    const duration = Number.parseInt(planDuration, 10);
    if (!planTitle.trim() || !planGoal.trim()) {
      toast.error("Plan title and goal are required.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Duration must be a positive number.");
      return;
    }

    try {
      const linkedResource = learningLinks.find((link) => link.href === planResourceUrl);
      const draftPayload = {
        title: planTitle.trim(),
        goal: planGoal.trim(),
        sessionDate: planDate,
        durationMinutes: duration,
        notes: planNotes.trim(),
        resourceTitle: linkedResource?.title,
        resourceUrl: linkedResource?.href,
      };
      let created: StudyPlanItem;

      if (storageMode === "remote") {
        created = await createStudyPlan(draftPayload);
      } else {
        const now = new Date().toISOString();
        created = {
          id: `${Date.now()}-${Math.random()}`,
          createdAt: now,
          updatedAt: now,
          ...draftPayload,
        };
      }

      const nextPlans = [created, ...studyPlans];
      setStudyPlans(nextPlans);
      if (storageMode === "local") {
        saveLocalItems(LOCAL_STUDY_PLANS_KEY, nextPlans);
      }
      setPlanTitle("");
      setPlanGoal("");
      setPlanNotes("");
      toast.success(storageMode === "remote" ? "Study plan saved to Firestore." : "Study plan saved locally in this browser.");
    } catch (error) {
      const linkedResource = learningLinks.find((link) => link.href === planResourceUrl);
      const now = new Date().toISOString();
      const created: StudyPlanItem = {
        id: `${Date.now()}-${Math.random()}`,
        title: planTitle.trim(),
        goal: planGoal.trim(),
        sessionDate: planDate,
        durationMinutes: duration,
        notes: planNotes.trim(),
        resourceTitle: linkedResource?.title,
        resourceUrl: linkedResource?.href,
        createdAt: now,
        updatedAt: now,
      };
      const nextPlans = [created, ...studyPlans];
      setStudyPlans(nextPlans);
      saveLocalItems(LOCAL_STUDY_PLANS_KEY, nextPlans);
      setStorageMode("local");
      setLoadNotice("Backend storage is unavailable. New items will be saved locally in this browser until Firestore is configured.");
      toast.success("Study plan saved locally in this browser.");
    }
  };

  const updateLinkScheduleDraft = (
    href: string,
    field: "date" | "startTime" | "endTime" | "notes",
    value: string,
  ) => {
    setLinkScheduleDrafts((current) => ({
      ...current,
      [href]: {
        ...current[href],
        [field]: value,
      },
    }));
  };

  const handleCreateLinkedSchedule = async (linkTitle: string, href: string) => {
    const draft = linkScheduleDrafts[href];
    if (!draft) {
      toast.error("Link schedule form is not ready.");
      return;
    }

    try {
      const draftPayload = {
        title: `Study: ${linkTitle}`,
        description: draft.notes.trim().length > 0 ? `${draft.notes.trim()}\n${href}` : href,
        startAt: `${draft.date}T${draft.startTime}:00`,
        endAt: `${draft.date}T${draft.endTime}:00`,
        resourceTitle: linkTitle,
        resourceUrl: href,
      };
      let created: ScheduleItem;

      if (storageMode === "remote") {
        created = await createSchedule(draftPayload);
      } else {
        const now = new Date().toISOString();
        created = {
          id: `${Date.now()}-${Math.random()}`,
          createdAt: now,
          updatedAt: now,
          ...draftPayload,
        };
      }

      const nextSchedules = [created, ...schedules];
      setSchedules(nextSchedules);
      if (storageMode === "local") {
        saveLocalItems(LOCAL_SCHEDULES_KEY, nextSchedules);
      }
      setLinkScheduleDrafts((current) => ({
        ...current,
        [href]: {
          ...current[href],
          notes: "",
        },
      }));
      toast.success(storageMode === "remote" ? `Scheduled study session for ${linkTitle}.` : `Scheduled ${linkTitle} locally in this browser.`);
    } catch (error) {
      const now = new Date().toISOString();
      const created: ScheduleItem = {
        id: `${Date.now()}-${Math.random()}`,
        title: `Study: ${linkTitle}`,
        description: draft.notes.trim().length > 0 ? `${draft.notes.trim()}\n${href}` : href,
        startAt: `${draft.date}T${draft.startTime}:00`,
        endAt: `${draft.date}T${draft.endTime}:00`,
        resourceTitle: linkTitle,
        resourceUrl: href,
        createdAt: now,
        updatedAt: now,
      };
      const nextSchedules = [created, ...schedules];
      setSchedules(nextSchedules);
      saveLocalItems(LOCAL_SCHEDULES_KEY, nextSchedules);
      setStorageMode("local");
      setLoadNotice("Backend storage is unavailable. New items will be saved locally in this browser until Firestore is configured.");
      setLinkScheduleDrafts((current) => ({
        ...current,
        [href]: {
          ...current[href],
          notes: "",
        },
      }));
      toast.success(`Scheduled ${linkTitle} locally in this browser.`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,168,133,0.20),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(39,83,210,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-10 space-y-6">
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <h1 className="text-4xl md:text-5xl leading-tight max-w-4xl">Calendar and Study Schedule Planner</h1>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => navigate(isAdmin ? "/admin" : "/login")}
              >
                {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                {isAdmin ? "Admin" : "Admin Login"}
              </Button>
            </div>
            <p className="text-muted-foreground max-w-3xl text-base leading-7">
              Plan study sessions, map focused schedules, and keep your daily study workflow in one place. All schedule and study-plan records are read from and saved to Firestore through the backend API.
            </p>
            {loadNotice && (
              <div className="max-w-3xl rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
                {loadNotice}
              </div>
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
            <Card className="border-primary/30 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CalendarClock className="h-5 w-5" />
                  Study Calendar
                </CardTitle>
                <CardDescription>
                  Pick a day to inspect scheduled sessions and planned study goals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-background/60 p-2">
                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="mx-auto" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Selected date: {selectedDate ? format(selectedDate, "EEEE, MMM d, yyyy") : "None"}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-border bg-card/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    Add Study Plan
                  </CardTitle>
                  <CardDescription>
                    A study plan captures the purpose of a study session: what you want to finish, how long it should take, and any notes for that day.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor="plan-resource">Learning Resource</Label>
                  <select
                    id="plan-resource"
                    value={planResourceUrl}
                    onChange={(event) => setPlanResourceUrl(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {learningLinks.map((link) => (
                      <option key={link.href} value={link.href}>
                        {link.title}
                      </option>
                    ))}
                  </select>
                  <Label htmlFor="plan-title">Title</Label>
                  <Input
                    id="plan-title"
                    value={planTitle}
                    onChange={(event) => setPlanTitle(event.target.value)}
                    placeholder="Exam Week Plan"
                  />
                  <Label htmlFor="plan-goal">Goal</Label>
                  <Textarea
                    id="plan-goal"
                    value={planGoal}
                    onChange={(event) => setPlanGoal(event.target.value)}
                    placeholder="Finish chapters 3-5 and complete 2 mock tests."
                  />
                  <Label htmlFor="plan-date">Session Date</Label>
                  <Input
                    id="plan-date"
                    type="date"
                    value={planDate}
                    onChange={(event) => setPlanDate(event.target.value)}
                  />
                  <Label htmlFor="plan-duration">Duration (minutes)</Label>
                  <Input
                    id="plan-duration"
                    type="number"
                    min={1}
                    value={planDuration}
                    onChange={(event) => setPlanDuration(event.target.value)}
                  />
                  <Label htmlFor="plan-notes">Notes</Label>
                  <Textarea
                    id="plan-notes"
                    value={planNotes}
                    onChange={(event) => setPlanNotes(event.target.value)}
                    placeholder="Keep first session for difficult topics."
                  />
                  <Button className="w-full" variant="outline" onClick={handleCreatePlan}>
                    Save Study Plan
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Schedules for Selected Day</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading && <p className="text-sm text-muted-foreground">Loading schedules...</p>}
                {!isLoading && daySchedules.length === 0 && (
                  <p className="text-sm text-muted-foreground">No schedule entries for this date.</p>
                )}
                {daySchedules.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-background/50 p-3 space-y-1">
                    <p>{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.startAt), "h:mm a")} - {format(new Date(item.endAt), "h:mm a")}
                    </p>
                    {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Study Plans for Selected Day</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading && <p className="text-sm text-muted-foreground">Loading study plans...</p>}
                {!isLoading && dayPlans.length === 0 && (
                  <p className="text-sm text-muted-foreground">No study plans for this date.</p>
                )}
                {dayPlans.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-background/50 p-3 space-y-1">
                    <p>{item.title}</p>
                    <p className="text-sm text-muted-foreground">Goal: {item.goal}</p>
                    <p className="text-xs text-muted-foreground">Duration: {item.durationMinutes} minutes</p>
                    {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section>
            <Card className="border-primary/20 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Learning Links</CardTitle>
                <CardDescription>
                  Quick access to the study and training platforms you wanted available from the main interface.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {learningLinks.map((link) => (
                  <div
                    key={link.href}
                    className="rounded-xl border border-border bg-background/50 p-4 transition-colors hover:border-primary/40 hover:bg-background/70"
                  >
                    <a href={link.href} target="_blank" rel="noreferrer" className="block">
                      <p>{link.title}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{link.description}</p>
                      <p className="mt-4 text-xs text-primary break-all">{link.href}</p>
                    </a>
                    <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
                      <p className="text-sm">Schedule study time for this link</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <Label htmlFor={`link-date-${link.title}`}>Date</Label>
                          <Input
                            id={`link-date-${link.title}`}
                            type="date"
                            value={linkScheduleDrafts[link.href]?.date ?? format(new Date(), "yyyy-MM-dd")}
                            onChange={(event) => updateLinkScheduleDraft(link.href, "date", event.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`link-start-${link.title}`}>Start</Label>
                          <Input
                            id={`link-start-${link.title}`}
                            type="time"
                            value={linkScheduleDrafts[link.href]?.startTime ?? "18:00"}
                            onChange={(event) => updateLinkScheduleDraft(link.href, "startTime", event.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`link-end-${link.title}`}>End</Label>
                          <Input
                            id={`link-end-${link.title}`}
                            type="time"
                            value={linkScheduleDrafts[link.href]?.endTime ?? "19:00"}
                            onChange={(event) => updateLinkScheduleDraft(link.href, "endTime", event.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`link-notes-${link.title}`}>Session Notes</Label>
                        <Textarea
                          id={`link-notes-${link.title}`}
                          value={linkScheduleDrafts[link.href]?.notes ?? ""}
                          onChange={(event) => updateLinkScheduleDraft(link.href, "notes", event.target.value)}
                          placeholder="What do you want to cover in this resource?"
                        />
                      </div>
                      <Button className="w-full" variant="outline" onClick={() => handleCreateLinkedSchedule(link.title, link.href)}>
                        Schedule This Resource
                      </Button>
                      <div className="space-y-2 border-t border-border/70 pt-4">
                        <p className="text-sm">Scheduled sessions for this resource</p>
                        {schedules.filter((item) => item.resourceUrl === link.href).length === 0 && (
                          <p className="text-xs text-muted-foreground">No linked schedules yet.</p>
                        )}
                        {schedules.filter((item) => item.resourceUrl === link.href).map((item) => (
                          <div key={item.id} className="rounded-lg border border-border bg-background/60 p-3">
                            <p className="text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.startAt), "EEE, MMM d h:mm a")} - {format(new Date(item.endAt), "h:mm a")}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 border-t border-border/70 pt-4">
                        <p className="text-sm">Study plans for this resource</p>
                        {studyPlans.filter((item) => item.resourceUrl === link.href).length === 0 && (
                          <p className="text-xs text-muted-foreground">No linked study plans yet.</p>
                        )}
                        {studyPlans.filter((item) => item.resourceUrl === link.href).map((item) => (
                          <div key={item.id} className="rounded-lg border border-border bg-background/60 p-3 space-y-1">
                            <p className="text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground">Goal: {item.goal}</p>
                            <p className="text-xs text-muted-foreground">{item.sessionDate} · {item.durationMinutes} min</p>
                            {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
