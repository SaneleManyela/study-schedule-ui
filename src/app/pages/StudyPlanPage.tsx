import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ListChecks, Pencil, Trash2, X } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { useStudy } from "../lib/study-context";
import { toast } from "sonner";
import { type StudyPlanItem, type ScheduleItem } from "../lib/api";

export function StudyPlanPage() {
  const {
    courses,
    studyPlans,
    schedules,
    useRemote,
    addStudyPlan,
    updateStudyPlan,
    removeStudyPlan,
    updateSchedule,
    removeSchedule,
  } = useStudy();

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [planTitle, setPlanTitle] = useState("");
  const [planGoal, setPlanGoal] = useState("");
  const [planDate, setPlanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [planDuration, setPlanDuration] = useState("60");
  const [planNotes, setPlanNotes] = useState("");

  // Edit states for study plans
  const [editingPlan, setEditingPlan] = useState<StudyPlanItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Edit states for schedules
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [editScheduleTitle, setEditScheduleTitle] = useState("");
  const [editScheduleDate, setEditScheduleDate] = useState("");
  const [editScheduleStart, setEditScheduleStart] = useState("");
  const [editScheduleEnd, setEditScheduleEnd] = useState("");

  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

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
        const { createStudyPlan } = await import("../lib/api");
        item = await createStudyPlan(payload);
      } catch {
        const now = new Date().toISOString();
        item = { id: `${Date.now()}-${Math.random()}`, ...payload, createdAt: now, updatedAt: now };
      }
    } else {
      const now = new Date().toISOString();
      item = { id: `${Date.now()}-${Math.random()}`, ...payload, createdAt: now, updatedAt: now };
    }
    addStudyPlan(item);
    setPlanTitle("");
    setPlanGoal("");
    setPlanNotes("");
    toast.success("Study plan saved.");
  };

  // Edit study plan handlers
  const openEditPlan = (plan: StudyPlanItem) => {
    setEditingPlan(plan);
    setEditTitle(plan.title);
    setEditGoal(plan.goal);
    setEditDate(plan.sessionDate);
    setEditDuration(String(plan.durationMinutes));
    setEditNotes(plan.notes);
  };

  const closeEditPlan = () => {
    setEditingPlan(null);
    setEditTitle("");
    setEditGoal("");
    setEditDate("");
    setEditDuration("");
    setEditNotes("");
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;
    const duration = Number.parseInt(editDuration, 10);
    if (!editTitle.trim() || !editGoal.trim()) {
      toast.error("Title and goal are required.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Duration must be a positive number.");
      return;
    }
    const updated: StudyPlanItem = {
      ...editingPlan,
      title: editTitle.trim(),
      goal: editGoal.trim(),
      sessionDate: editDate,
      durationMinutes: duration,
      notes: editNotes.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (useRemote) {
      try {
        const { updateStudyPlan: apiUpdate } = await import("../lib/api");
        const saved = await apiUpdate(editingPlan.id, {
          title: editTitle.trim(),
          goal: editGoal.trim(),
          sessionDate: editDate,
          durationMinutes: duration,
          notes: editNotes.trim(),
        });
        updateStudyPlan(saved);
      } catch {
        updateStudyPlan(updated);
      }
    } else {
      updateStudyPlan(updated);
    }
    closeEditPlan();
    toast.success("Study plan updated.");
  };

  const handleDeletePlan = async (id: string) => {
    if (useRemote) {
      try {
        const { deleteStudyPlan: apiDelete } = await import("../lib/api");
        await apiDelete(id);
      } catch {
        // Continue with local delete
      }
    }
    removeStudyPlan(id);
    toast.success("Study plan deleted.");
  };

  // Edit schedule handlers
  const openEditSchedule = (schedule: ScheduleItem) => {
    setEditingSchedule(schedule);
    setEditScheduleTitle(schedule.title);
    setEditScheduleDate(schedule.startAt.slice(0, 10));
    setEditScheduleStart(schedule.startAt.slice(11, 16));
    setEditScheduleEnd(schedule.endAt.slice(11, 16));
  };

  const closeEditSchedule = () => {
    setEditingSchedule(null);
    setEditScheduleTitle("");
    setEditScheduleDate("");
    setEditScheduleStart("");
    setEditScheduleEnd("");
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;
    if (!editScheduleTitle.trim()) {
      toast.error("Title is required.");
      return;
    }
    const startAt = `${editScheduleDate}T${editScheduleStart}:00`;
    const endAt = `${editScheduleDate}T${editScheduleEnd}:00`;
    const updated: ScheduleItem = {
      ...editingSchedule,
      title: editScheduleTitle.trim(),
      startAt,
      endAt,
      updatedAt: new Date().toISOString(),
    };
    if (useRemote) {
      try {
        const { updateSchedule: apiUpdate } = await import("../lib/api");
        const saved = await apiUpdate(editingSchedule.id, {
          title: editScheduleTitle.trim(),
          startAt,
          endAt,
        });
        updateSchedule(saved);
      } catch {
        updateSchedule(updated);
      }
    } else {
      updateSchedule(updated);
    }
    closeEditSchedule();
    toast.success("Schedule updated.");
  };

  const handleDeleteSchedule = async (id: string) => {
    if (useRemote) {
      try {
        const { deleteSchedule: apiDelete } = await import("../lib/api");
        await apiDelete(id);
      } catch {
        // Continue with local delete
      }
    }
    removeSchedule(id);
    toast.success("Schedule deleted.");
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
                  <li key={s.id} className="text-sm flex items-center justify-between group">
                    <div>
                      <span className="font-medium">{s.title}</span>
                      <span className="text-muted-foreground ml-2">
                        {format(parseISO(s.startAt), "h:mm a")} – {format(parseISO(s.endAt), "h:mm a")}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditSchedule(s)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Edit schedule"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(s.id)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                        title="Delete schedule"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
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
                  <li key={p.id} className="text-sm flex items-center justify-between group">
                    <div>
                      <span className="font-medium">{p.title}</span>
                      {p.resourceTitle && (
                        <span className="text-muted-foreground ml-2">· {p.resourceTitle}</span>
                      )}
                      <span className="text-muted-foreground ml-2">· {p.durationMinutes} min</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditPlan(p)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Edit study plan"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(p.id)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                        title="Delete study plan"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Study Plan Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && closeEditPlan()}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Study Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Exam Week Plan"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Goal</Label>
              <Textarea
                value={editGoal}
                onChange={(e) => setEditGoal(e.target.value)}
                placeholder="Finish chapters 3-5..."
                rows={3}
                className="bg-secondary border-border resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Session Date</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
                min={1}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes..."
                rows={2}
                className="bg-secondary border-border resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditPlan}>Cancel</Button>
            <Button onClick={handleUpdatePlan} className="bg-primary hover:bg-primary/80">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={!!editingSchedule} onOpenChange={(open) => !open && closeEditSchedule()}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={editScheduleTitle}
                onChange={(e) => setEditScheduleTitle(e.target.value)}
                placeholder="Study Session"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={editScheduleDate}
                onChange={(e) => setEditScheduleDate(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input
                  type="time"
                  value={editScheduleStart}
                  onChange={(e) => setEditScheduleStart(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input
                  type="time"
                  value={editScheduleEnd}
                  onChange={(e) => setEditScheduleEnd(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditSchedule}>Cancel</Button>
            <Button onClick={handleUpdateSchedule} className="bg-primary hover:bg-primary/80">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}