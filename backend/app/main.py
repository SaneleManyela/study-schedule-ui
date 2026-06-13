"""FastAPI application entrypoint for the calendar and study planner backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    HealthResponse,
    ScheduleCreate,
    ScheduleItem,
    StudyPlanCreate,
    StudyPlanItem,
    SendPinRequest,
    SendPinResponse,
    VerifyPasswordRequest,
    VerifyPasswordResponse,
    VerifyPinRequest,
    VerifyPinResponse,
    CheckEmailRequest,
    CheckEmailResponse,
    SignupRequest,
    SignupResponse,
    CourseCreate,
    CourseItem,
    CourseUpdate,
    LibraryItemCreate,
    LibraryItem,
    CourseNoteUpsert,
    CourseNoteItem,
)
from .service import (
    create_schedule, create_study_plan, list_schedules, list_study_plans,
    verify_admin_password, send_admin_pin, verify_admin_pin,
    check_admin_email, signup_admin,
    list_courses, create_course, update_course, delete_course,
    list_library_items, create_library_item, delete_library_item,
    get_course_note, upsert_course_note,
)


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
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://sanelemanyela.github.io",
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


@app.post("/api/auth/verify-password", response_model=VerifyPasswordResponse)
def auth_verify_password(payload: VerifyPasswordRequest) -> VerifyPasswordResponse:
    """Verify admin password against the passwords Firestore collection."""

    return verify_admin_password(payload.password, payload.email)


@app.post("/api/auth/check-email", response_model=CheckEmailResponse)
def auth_check_email(payload: CheckEmailRequest) -> CheckEmailResponse:
    """Check whether an Auth document exists for a given email."""

    return check_admin_email(payload.email)


@app.post("/api/auth/signup", response_model=SignupResponse)
def auth_signup(payload: SignupRequest) -> SignupResponse:
    """Create a new admin account if the email is not already registered."""

    return signup_admin(payload.email, payload.password)


@app.post("/api/auth/send-pin", response_model=SendPinResponse)
def auth_send_pin(payload: SendPinRequest) -> SendPinResponse:
    """Generate and send a 6-digit PIN to the given admin email."""

    return send_admin_pin(payload.email)


@app.post("/api/auth/verify-pin", response_model=VerifyPinResponse)
def auth_verify_pin(payload: VerifyPinRequest) -> VerifyPinResponse:
    """Verify the submitted PIN."""

    return verify_admin_pin(payload.pin, payload.email)


# ─── Courses ────────────────────────────────────────────────────────────────

@app.get("/api/courses", response_model=list[CourseItem])
def get_courses() -> list[CourseItem]:
    return list_courses()


@app.post("/api/courses", response_model=CourseItem)
def post_course(payload: CourseCreate) -> CourseItem:
    return create_course(payload)


@app.put("/api/courses/{course_id}", response_model=CourseItem)
def put_course(course_id: str, payload: CourseUpdate) -> CourseItem:
    return update_course(course_id, payload)


@app.delete("/api/courses/{course_id}", status_code=204)
def remove_course(course_id: str) -> None:
    delete_course(course_id)


# ─── Library ─────────────────────────────────────────────────────────────────

@app.get("/api/library", response_model=list[LibraryItem])
def get_library() -> list[LibraryItem]:
    return list_library_items()


@app.post("/api/library", response_model=LibraryItem)
def post_library_item(payload: LibraryItemCreate) -> LibraryItem:
    return create_library_item(payload)


@app.delete("/api/library/{item_id}", status_code=204)
def remove_library_item(item_id: str) -> None:
    delete_library_item(item_id)


# ─── Course Notes ─────────────────────────────────────────────────────────────

@app.get("/api/notes/{course_id}", response_model=CourseNoteItem | None)
def get_note(course_id: str) -> CourseNoteItem | None:
    """Return the note for a course, or null if none exists."""
    return get_course_note(course_id)


@app.put("/api/notes/{course_id}", response_model=CourseNoteItem)
def put_note(course_id: str, payload: CourseNoteUpsert) -> CourseNoteItem:
    """Create or overwrite the note for a course."""
    return upsert_course_note(course_id, payload)