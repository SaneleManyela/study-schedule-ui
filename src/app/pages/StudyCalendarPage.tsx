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
  getMonth,
  getYear,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  loadLocal,
  saveLocal,
  type ScheduleItem,
} from "../lib/api";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";

const LS_SCHEDULES = "study-planner-local-schedules";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am–7pm

export function StudyCalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [miniMonth, setMiniMonth] = useState(new Date());
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => loadLocal<ScheduleItem>(LS_SCHEDULES));
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)); // Mon–Fri

  const persist = (next: ScheduleItem[]) => {
    setSchedules(next);
    saveLocal(LS_SCHEDULES, next);
  };

  const openDialogForSlot = (day: Date, hour?: number) => {
    setNewDate(format(day, "yyyy-MM-dd"));
    const startHour = hour ?? 9;
    setNewStart(`${String(startHour).padStart(2, "0")}:00`);
    setNewEnd(`${String(Math.min(startHour + 1, 23)).padStart(2, "0")}:00`);
    setNewTitle("");
    setNewEventOpen(true);
  };

  const handleAddEvent = () => {
    if (!newTitle.trim()) { toast.error("Title is required."); return; }
    const now = new Date().toISOString();
    const item: ScheduleItem = {
      id: `${Date.now()}-${Math.random()}`,
      title: newTitle.trim(),
      description: "",
      startAt: `${newDate}T${newStart}:00`,
      endAt: `${newDate}T${newEnd}:00`,
      createdAt: now,
      updatedAt: now,
    };
    persist([item, ...schedules]);
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
                  {hasEvent && (
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
        <div className="grid border-b border-border" style={{ gridTemplateColumns: "56px repeat(5, 1fr)" }}>
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
                style={{ gridTemplateColumns: "56px repeat(5, 1fr)", height: 56 }}
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
                          className="text-[11px] bg-primary/80 text-primary-foreground rounded px-1.5 py-0.5 truncate leading-tight mb-0.5"
                          title={ev.title}
                        >
                          {ev.title}
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
    </div>
  );
}
