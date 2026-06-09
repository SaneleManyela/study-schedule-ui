import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Clock3, ListChecks } from "lucide-react";

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

export function SystemsHomePage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [scheduleDescription, setScheduleDescription] = useState("");

  const [planTitle, setPlanTitle] = useState("");
  const [planGoal, setPlanGoal] = useState("");
  const [planDate, setPlanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [planDuration, setPlanDuration] = useState("60");
  const [planNotes, setPlanNotes] = useState("");

  useEffect(() => {
    const loadPlannerData = async () => {
      try {
        const [scheduleData, planData] = await Promise.all([listSchedules(), listStudyPlans()]);
        setSchedules(scheduleData);
        setStudyPlans(planData);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load planner data";
        toast.error(message);
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

  const handleCreateSchedule = async () => {
    if (!scheduleTitle.trim()) {
      toast.error("Schedule title is required.");
      return;
    }

    try {
      const created = await createSchedule({
        title: scheduleTitle.trim(),
        description: scheduleDescription.trim(),
        startAt: `${scheduleDate}T${startTime}:00`,
        endAt: `${scheduleDate}T${endTime}:00`,
      });
      setSchedules((current) => [created, ...current]);
      setScheduleTitle("");
      setScheduleDescription("");
      toast.success("Schedule saved to Firestore.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create schedule";
      toast.error(message);
    }
  };

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
      const created = await createStudyPlan({
        title: planTitle.trim(),
        goal: planGoal.trim(),
        sessionDate: planDate,
        durationMinutes: duration,
        notes: planNotes.trim(),
      });
      setStudyPlans((current) => [created, ...current]);
      setPlanTitle("");
      setPlanGoal("");
      setPlanNotes("");
      toast.success("Study plan saved to Firestore.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create study plan";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,168,133,0.20),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(39,83,210,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-10 space-y-6">
          <section className="space-y-3">
            <h1 className="text-4xl md:text-5xl leading-tight max-w-4xl">Calendar and Study Schedule Planner</h1>
            <p className="text-muted-foreground max-w-3xl text-base leading-7">
              Plan study sessions, map focused schedules, and keep your daily study workflow in one place. All schedule and study-plan records are read from and saved to Firestore through the backend API.
            </p>
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
                    <Clock3 className="h-5 w-5 text-primary" />
                    Add Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor="schedule-title">Title</Label>
                  <Input
                    id="schedule-title"
                    value={scheduleTitle}
                    onChange={(event) => setScheduleTitle(event.target.value)}
                    placeholder="Deep work: Biology revision"
                  />
                  <Label htmlFor="schedule-date">Date</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={scheduleDate}
                    onChange={(event) => setScheduleDate(event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="schedule-start">Start</Label>
                      <Input
                        id="schedule-start"
                        type="time"
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule-end">End</Label>
                      <Input
                        id="schedule-end"
                        type="time"
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                      />
                    </div>
                  </div>
                  <Label htmlFor="schedule-description">Description</Label>
                  <Textarea
                    id="schedule-description"
                    value={scheduleDescription}
                    onChange={(event) => setScheduleDescription(event.target.value)}
                    placeholder="Focus on summary notes and active recall."
                  />
                  <Button className="w-full" onClick={handleCreateSchedule}>Save Schedule</Button>
                </CardContent>
              </Card>

              <Card className="border-border bg-card/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    Add Study Plan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
        </div>
      </div>
    </div>
  );
}
