"""FastAPI application entrypoint for the calendar and study planner backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    HealthResponse,
    ScheduleCreate,
    ScheduleItem,
    StudyPlanCreate,
    StudyPlanItem,
)
from .service import create_schedule, create_study_plan, list_schedules, list_study_plans


# Create the FastAPI app object and expose API metadata visible in docs.
app = FastAPI(
    title="Study Planner API",
    version="0.1.0",
    description="FastAPI service for calendar schedules and study plans backed by Firestore.",
)

# Allow the local React dev server origins to access this API.
#
# Why this exists:
# - Browser security blocks cross-origin requests by default.
# - The frontend runs on port 5173 during development.
# - The backend runs on port 8000.
#
# In production, replace these origins with deployed frontend origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Lightweight liveness endpoint used by frontend and tooling checks.

    Returns:
        HealthResponse: Static "ok" payload that confirms the API process is up.
    """

    # Keep this endpoint deterministic and side-effect free.
    return HealthResponse(status="ok", mode="study-planner")


@app.get("/api/schedules", response_model=list[ScheduleItem])
def get_schedules() -> list[ScheduleItem]:
    """Return all schedule entries from Firestore."""

    return list_schedules()


@app.post("/api/schedules", response_model=ScheduleItem)
def post_schedule(payload: ScheduleCreate) -> ScheduleItem:
    """Create a schedule entry in Firestore."""

    return create_schedule(payload)


@app.get("/api/study-plans", response_model=list[StudyPlanItem])
def get_study_plans() -> list[StudyPlanItem]:
    """Return all study plan entries from Firestore."""

    return list_study_plans()


@app.post("/api/study-plans", response_model=StudyPlanItem)
def post_study_plan(payload: StudyPlanCreate) -> StudyPlanItem:
    """Create a study plan entry in Firestore."""

    return create_study_plan(payload)