import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
  listCourses,
  listStudyPlans as apiListStudyPlans,
  createStudyPlan as apiCreateStudyPlan,
  listSchedules as apiListSchedules,
  type Course,
  type StudyPlanItem,
  type ScheduleItem,
} from "../lib/api";
import { toast } from "sonner";

const LS_SCHEDULES = "study-planner-local-schedules";
const LS_PLANS = "study-planner-local-study-plans";

export function StudyPlanPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => loadLocal<ScheduleItem>(LS_SCHEDULES));
  const [studyPlans, setStudyPlans] = useState<StudyPlanItem[]>(() => loadLocal<StudyPlanItem>(LS_PLANS));
  const [useRemote, setUseRemote] = useState(true);

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [planTitle, setPlanTitle] = useState("");
  const [planGoal, setPlanGoal] = useState("");
  const [planDate, setPlanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [planDuration, setPlanDuration] = useState("60");
  const [planNotes, setPlanNotes] = useState("");

  useEffect(() => {
    listCourses()
      .then((data) => { setCourses(data); saveLocal(LS_COURSES, data); if (data.length > 0) setSelectedCourseId((id) => id || data[0].id); })
      .catch(() => { const loaded = loadLocal<Course>(LS_COURSES); setCourses(loaded); if (loaded.length > 0) setSelectedCourseId(loaded[0].id); setUseRemote(false); });
    apiListStudyPlans()
      .then((data) => { setStudyPlans(data); saveLocal(LS_PLANS, data); })
      .catch(() => setUseRemote(false));
    apiListSchedules()
      .then((data) => { setSchedules(data); saveLocal(LS_SCHEDULES, data); })
      .catch(() => setUseRemote(false));
  }, []);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const daySchedules = useMemo(
    () => schedules.filter((s) => s.startAt.slice(0, 10) === planDate),
    [schedules, planDate],
  );

  const dayPlans = useMemo(
    () => studyPlans.filter((p) => p.sessionDate === planDate),
    [studyPlans, planDate],
  );

  const handleSave = async () => {
    const duration = Number.parseInt(planDuration, 10);
    if (!planTitle.trim() || !planGoal.trim()) {
      toast.error("Title and goal are required.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Duration must be a positive number.");
      return;
    }
    const payload = {
      title: planTitle.trim(),
      goal: planGoal.trim(),
      sessionDate: planDate,
      durationMinutes: duration,
      notes: planNotes.trim(),
      resourceTitle: selectedCourse?.name,
    };
    let item: StudyPlanItem;
    if (useRemote) {
      try {
        item = await apiCreateStudyPlan(payload);
      } catch {
        setUseRemote(false);
        const now = new Date().toISOString();
        item = { id: `${Date.now()}-${Math.random()}`, ...payload, createdAt: now, updatedAt: now };
      }
    } else {
      const now = new Date().toISOString();
      item = { id: `${Date.now()}-${Math.random()}`, ...payload, createdAt: now, updatedAt: now };
    }
    const next = [item, ...studyPlans];
    setStudyPlans(next);
    saveLocal(LS_PLANS, next);
    setPlanTitle("");
    setPlanGoal("");
    setPlanNotes("");
    toast.success("Study plan saved.");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Form card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Add Study Plan
          </CardTitle>
          <CardDescription>
            A study plan captures the purpose of a study session: what you want to finish, how long it should take, and any notes for that day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Course / Learning Resource dropdown */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Learning Resource</Label>
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses added yet. Add courses in Course Overview first.</p>
            ) : (
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="bg-secondary border-border w-full">
                  <SelectValue placeholder="Select a course..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Title</Label>
            <Input
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              placeholder="Exam Week Plan"
              className="bg-secondary border-border"
            />
          </div>

          {/* Goal */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Goal</Label>
            <Textarea
              value={planGoal}
              onChange={(e) => setPlanGoal(e.target.value)}
              placeholder="Finish chapters 3-5 and complete 2 mock tests."
              rows={3}
              className="bg-secondary border-border resize-none"
            />
          </div>

          {/* Session Date */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Session Date</Label>
            <Input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Duration (minutes)</Label>
            <Input
              type="number"
              value={planDuration}
              onChange={(e) => setPlanDuration(e.target.value)}
              min={1}
              className="bg-secondary border-border"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Notes</Label>
            <Textarea
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
              placeholder="Keep first session for difficult topics."
              rows={2}
              className="bg-secondary border-border resize-none"
            />
          </div>

          <Button onClick={handleSave} className="w-full bg-secondary hover:bg-secondary/80 text-foreground border border-border">
            Save Study Plan
          </Button>
        </CardContent>
      </Card>

      {/* Day summary row */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Schedules for Selected Day</CardTitle>
          </CardHeader>
          <CardContent>
            {daySchedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No schedule entries for this date.</p>
            ) : (
              <ul className="space-y-2">
                {daySchedules.map((s) => (
                  <li key={s.id} className="text-sm">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted-foreground ml-2">
                      {format(parseISO(s.startAt), "h:mm a")} – {format(parseISO(s.endAt), "h:mm a")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Study Plans for Selected Day</CardTitle>
          </CardHeader>
          <CardContent>
            {dayPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No study plans for this date.</p>
            ) : (
              <ul className="space-y-2">
                {dayPlans.map((p) => (
                  <li key={p.id} className="text-sm">
                    <span className="font-medium">{p.title}</span>
                    {p.resourceTitle && (
                      <span className="text-muted-foreground ml-2">· {p.resourceTitle}</span>
                    )}
                    <span className="text-muted-foreground ml-2">· {p.durationMinutes} min</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
