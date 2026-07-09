import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  loadLocal,
  saveLocal,
  listCourses,
  listStudyPlans,
  listSchedules,
  type Course,
  type StudyPlanItem,
  type ScheduleItem,
} from "./api";

// Local storage keys
export const LS_COURSES = "study-planner-courses";
export const LS_PLANS = "study-planner-local-study-plans";
export const LS_SCHEDULES = "study-planner-local-schedules";

// Context types
interface StudyContextValue {
  courses: Course[];
  studyPlans: StudyPlanItem[];
  schedules: ScheduleItem[];
  useRemote: boolean;
  refreshData: () => Promise<void>;
  addStudyPlan: (plan: StudyPlanItem) => void;
  updateStudyPlan: (plan: StudyPlanItem) => void;
  removeStudyPlan: (id: string) => void;
  addSchedule: (schedule: ScheduleItem) => void;
  updateSchedule: (schedule: ScheduleItem) => void;
  removeSchedule: (id: string) => void;
}

const StudyContext = createContext<StudyContextValue | null>(null);

export function useStudy() {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error("useStudy must be used within StudyProvider");
  return ctx;
}

export function StudyProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(() => loadLocal<Course>(LS_COURSES));
  const [studyPlans, setStudyPlans] = useState<StudyPlanItem[]>(() => loadLocal<StudyPlanItem>(LS_PLANS));
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => loadLocal<ScheduleItem>(LS_SCHEDULES));
  const [useRemote, setUseRemote] = useState(true);

  // Load data from backend on mount
  useEffect(() => {
    refreshData();
  }, []);

const refreshData = async () => {
    try {
      const [coursesData, plansData, schedulesData] = await Promise.all([
        listCourses().catch(() => { throw new Error("courses"); }),
        listStudyPlans().catch(() => { throw new Error("plans"); }),
        listSchedules().catch(() => { throw new Error("schedules"); }),
      ]);
      setCourses(coursesData);
      saveLocal(LS_COURSES, coursesData);
      setStudyPlans(plansData);
      saveLocal(LS_PLANS, plansData);
      setSchedules(schedulesData);
      saveLocal(LS_SCHEDULES, schedulesData);
    } catch {
      setUseRemote(false);
    }
  };

  const addStudyPlan = (plan: StudyPlanItem) => {
    const next = [plan, ...studyPlans];
    setStudyPlans(next);
    saveLocal(LS_PLANS, next);
  };

  const updateStudyPlan = (plan: StudyPlanItem) => {
    const next = studyPlans.map((p) => (p.id === plan.id ? plan : p));
    setStudyPlans(next);
    saveLocal(LS_PLANS, next);
  };

  const removeStudyPlan = (id: string) => {
    const next = studyPlans.filter((p) => p.id !== id);
    setStudyPlans(next);
    saveLocal(LS_PLANS, next);
  };

  const addSchedule = (schedule: ScheduleItem) => {
    const next = [schedule, ...schedules];
    setSchedules(next);
    saveLocal(LS_SCHEDULES, next);
  };

  const updateSchedule = (schedule: ScheduleItem) => {
    const next = schedules.map((s) => (s.id === schedule.id ? schedule : s));
    setSchedules(next);
    saveLocal(LS_SCHEDULES, next);
  };

  const removeSchedule = (id: string) => {
    const next = schedules.filter((s) => s.id !== id);
    setSchedules(next);
    saveLocal(LS_SCHEDULES, next);
  };

  return (
    <StudyContext.Provider
      value={{
        courses,
        studyPlans,
        schedules,
        useRemote,
        refreshData,
        addStudyPlan,
        updateStudyPlan,
        removeStudyPlan,
        addSchedule,
        updateSchedule,
        removeSchedule,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
}