import { useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
  isToday,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useStudy } from "../lib/study-context";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";
import { type StudyPlanItem, type ScheduleItem } from "../lib/api";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am–7pm

export function StudyCalendarPage() {
  const {
    schedules,
    studyPlans,
    useRemote,
    addSchedule,
    updateSchedule,
    removeSchedule,
    addStudyPlan,
    updateStudyPlan,
    removeStudyPlan,
  } = useStudy();

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [miniMonth, setMiniMonth] = useState(new Date());
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");

  // Edit states for schedules
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [editScheduleTitle, setEditScheduleTitle] = useState("");
  const [editScheduleDate, setEditScheduleDate] = useState("");
  const [editScheduleStart, setEditScheduleStart] = useState("");
  const [editScheduleEnd, setEditScheduleEnd] = useState("");

  // Edit states for study plans
  const [editingPlan, setEditingPlan] = useState<StudyPlanItem | null>(null);
  const [editPlanTitle, setEditPlanTitle] = useState("");
  const [editPlanGoal, setEditPlanGoal] = useState("");
  const [editPlanDate, setEditPlanDate] = useState("");
  const [editPlanDuration, setEditPlanDuration] = useState("");
  const [editPlanNotes, setEditPlanNotes] = useState("");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 }); // Sunday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)); // Sun–Sat

  const openDialogForSlot = (day: Date, hour?: number) => {
    setNewDate(format(day, "yyyy-MM-dd"));
    const startHour = hour ?? 9;
    setNewStart(`${String(startHour).padStart(2, "0")}:00`);
    setNewEnd(`${String(Math.min(startHour + 1, 23)).padStart(2, "0")}:00`);
    setNewTitle("");
    setNewEventOpen(true);
  };

  const handleAddEvent = async () => {
    if (!newTitle.trim()) { toast.error("Title is required."); return; }
    const now = new Date().toISOString();
    const startAt = `${newDate}T${newStart}:00`;
    const endAt = `${newDate}T${newEnd}:00`;
    try {
      const { createSchedule } = await import("../lib/api");
      const saved = await createSchedule({ title: newTitle.trim(), description: "", startAt, endAt });
      addSchedule(saved);
    } catch {
      // Backend unreachable — save locally
      const item: ScheduleItem = {
        id: `${Date.now()}-${Math.random()}`,
        title: newTitle.trim(),
        description: "",
        startAt,
        endAt,
        createdAt: now,
        updatedAt: now,
      };
      addSchedule(item);
    }
    setNewEventOpen(false);
    setNewTitle("");
    toast.success("Event added to calendar.");
  };

  // Mini calendar helpers
  const miniStart = startOfMonth(miniMonth);
  const miniEnd = endOfMonth(miniMonth);
  const miniDays = eachDayOfInterval({ start: miniStart, end: miniEnd });
  const miniPadStart = miniStart.getDay(); // 0=Sun

  // Events per day slot
  const eventsForDay = (day: Date) =>
    schedules.filter((s) => isSameDay(parseISO(s.startAt), day));

  // Study plans per day
  const plansForDay = (day: Date) =>
    studyPlans.filter((p) => p.sessionDate === format(day, "yyyy-MM-dd"));

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

  // Edit study plan handlers
  const openEditPlan = (plan: StudyPlanItem) => {
    setEditingPlan(plan);
    setEditPlanTitle(plan.title);
    setEditPlanGoal(plan.goal);
    setEditPlanDate(plan.sessionDate);
    setEditPlanDuration(String(plan.durationMinutes));
    setEditPlanNotes(plan.notes);
  };

  const closeEditPlan = () => {
    setEditingPlan(null);
    setEditPlanTitle("");
    setEditPlanGoal("");
    setEditPlanDate("");
    setEditPlanDuration("");
    setEditPlanNotes("");
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;
    const duration = Number.parseInt(editPlanDuration, 10);
    if (!editPlanTitle.trim() || !editPlanGoal.trim()) {
      toast.error("Title and goal are required.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Duration must be a positive number.");
      return;
    }
    const updated: StudyPlanItem = {
      ...editingPlan,
      title: editPlanTitle.trim(),
      goal: editPlanGoal.trim(),
      sessionDate: editPlanDate,
      durationMinutes: duration,
      notes: editPlanNotes.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (useRemote) {
      try {
        const { updateStudyPlan: apiUpdate } = await import("../lib/api");
        const saved = await apiUpdate(editingPlan.id, {
          title: editPlanTitle.trim(),
          goal: editPlanGoal.trim(),
          sessionDate: editPlanDate,
          durationMinutes: duration,
          notes: editPlanNotes.trim(),
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

  return (
    <div className="flex gap-4 h-full">
      {/* Mini calendar panel */}
      <aside className="w-56 shrink-0">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setMiniMonth(subMonths(miniMonth, 1))} className="text-muted-foreground hover:text-foreground p-1 rounded">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">
              {format(miniMonth, "MMMM yyyy")}
            </span>
            <button onClick={() => setMiniMonth(addMonths(miniMonth, 1))} className="text-muted-foreground hover:text-foreground p-1 rounded">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground mb-1">
            {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {Array.from({ length: miniPadStart }, (_, i) => <span key={`pad-${i}`} />)}
            {miniDays.map((day) => {
              const hasEvent = schedules.some((s) => isSameDay(parseISO(s.startAt), day));
              const hasPlan = studyPlans.some((p) => p.sessionDate === format(day, "yyyy-MM-dd"));
              const isCurrent = isToday(day);
              const isSelected = isSameDay(day, currentWeek);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setCurrentWeek(day)}
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center relative",
                    isCurrent && "bg-primary text-primary-foreground font-bold",
                    isSelected && !isCurrent && "ring-1 ring-primary text-primary",
                    !isCurrent && !isSelected && "hover:bg-secondary text-foreground",
                  )}
                >
                  {format(day, "d")}
                  {(hasEvent || hasPlan) && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Weekly grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-card border border-border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>Today</Button>
            <button onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className="text-muted-foreground hover:text-foreground p-1">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className="text-muted-foreground hover:text-foreground p-1">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold ml-1">
              {format(weekDays[0], "MMM d")} – {format(weekDays[weekDays.length - 1], "MMM d, yyyy")}
            </span>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/80"
            onClick={() => openDialogForSlot(new Date())}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div className="border-r border-border" />
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "py-2 text-center border-r border-border last:border-r-0",
                isToday(day) && "text-primary",
              )}
            >
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {format(day, "EEE")}
              </div>
              <button
                onClick={() => openDialogForSlot(day)}
                className={cn(
                  "text-xl font-bold mx-auto h-9 w-9 flex items-center justify-center rounded-full transition-colors hover:ring-2 hover:ring-primary/60",
                  isToday(day) && "bg-primary text-primary-foreground",
                  !isToday(day) && "hover:bg-secondary",
                )}
                title={`Add event on ${format(day, "EEE MMM d")}`}
              >
                {format(day, "d")}
              </button>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="overflow-y-auto flex-1">
          <div className="relative" style={{ minHeight: `${HOURS.length * 56}px` }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid border-b border-border/50"
                style={{ gridTemplateColumns: "56px repeat(7, 1fr)", height: 56 }}
              >
                <div className="text-[11px] text-muted-foreground pt-1 pr-2 text-right border-r border-border/50">
                  {format(new Date(2000, 0, 1, hour), "h a")}
                </div>
                {weekDays.map((day) => {
                  const dayEvents = eventsForDay(day).filter((ev) => {
                    const h = parseISO(ev.startAt).getHours();
                    return h === hour;
                  });
                  return (
                    <div
                      key={day.toISOString()}
                      className="border-r border-border/50 last:border-r-0 relative px-0.5 py-0.5 cursor-pointer hover:bg-primary/5 transition-colors group"
                      onClick={() => openDialogForSlot(day, hour)}
                      title={`Add event — ${format(day, "EEE MMM d")} at ${format(new Date(2000, 0, 1, hour), "h a")}`}
                    >
                      {dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="text-[11px] bg-primary/80 text-primary-foreground rounded px-1.5 py-0.5 truncate leading-tight mb-0.5 flex items-center justify-between"
                        >
                          <span className="flex-1 truncate" title={ev.title}>{ev.title}</span>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditSchedule(ev); }}
                              className="p-0.5 text-primary-foreground hover:text-white"
                              title="Edit schedule"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(ev.id); }}
                              className="p-0.5 text-primary-foreground hover:text-white"
                              title="Delete schedule"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New event dialog */}
      <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Add Event — {newDate ? format(new Date(newDate + "T00:00:00"), "EEE, MMM d yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Python Study Session" className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="bg-secondary border-border" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewEventOpen(false)}>Cancel</Button>
            <Button onClick={handleAddEvent} className="bg-primary hover:bg-primary/80">Add Event</Button>
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
                value={editPlanTitle}
                onChange={(e) => setEditPlanTitle(e.target.value)}
                placeholder="Exam Week Plan"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Goal</Label>
              <Textarea
                value={editPlanGoal}
                onChange={(e) => setEditPlanGoal(e.target.value)}
                placeholder="Finish chapters 3-5..."
                rows={3}
                className="bg-secondary border-border resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Session Date</Label>
              <Input
                type="date"
                value={editPlanDate}
                onChange={(e) => setEditPlanDate(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={editPlanDuration}
                onChange={(e) => setEditPlanDuration(e.target.value)}
                min={1}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={editPlanNotes}
                onChange={(e) => setEditPlanNotes(e.target.value)}
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
    </div>
  );
}