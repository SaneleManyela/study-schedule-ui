"""Pydantic schema models for the study planner backend."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Simple backend health status payload."""

    status: str
    mode: str


class ScheduleCreate(BaseModel):
    """Incoming payload for creating a schedule entry."""

    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    startAt: str = Field(..., min_length=10, max_length=40)
    endAt: str = Field(..., min_length=10, max_length=40)
    resourceTitle: str | None = Field(default=None, max_length=200)
    resourceUrl: str | None = Field(default=None, max_length=2000)


class ScheduleItem(ScheduleCreate):
    """Stored schedule entry returned to the client."""

    id: str
    createdAt: str
    updatedAt: str


class StudyPlanCreate(BaseModel):
    """Incoming payload for creating a study plan."""

    title: str = Field(..., min_length=1, max_length=200)
    goal: str = Field(..., min_length=1, max_length=2000)
    sessionDate: str = Field(..., min_length=10, max_length=20)
    durationMinutes: int = Field(..., gt=0, le=1440)
    notes: str = Field(default="", max_length=2000)
    resourceTitle: str | None = Field(default=None, max_length=200)
    resourceUrl: str | None = Field(default=None, max_length=2000)


class StudyPlanItem(StudyPlanCreate):
    """Stored study plan entry returned to the client."""

    id: str
    createdAt: str
    updatedAt: str


class VerifyPasswordRequest(BaseModel):
    """Incoming payload for POST /api/auth/verify-password."""

    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=256)


class CheckEmailRequest(BaseModel):
    """Incoming payload for POST /api/auth/check-email."""

    email: str = Field(..., min_length=3, max_length=254)


class CheckEmailResponse(BaseModel):
    exists: bool


class SignupRequest(BaseModel):
    """Incoming payload for POST /api/auth/signup."""

    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=256)


class VerifyPasswordResponse(BaseModel):
    success: bool
    error: str | None = None


class SendPinRequest(BaseModel):
    """Incoming payload for POST /api/auth/send-pin."""

    email: str = Field(..., min_length=3, max_length=254)


class VerifyPinRequest(BaseModel):
    """Incoming payload for POST /api/auth/verify-pin."""

    email: str = Field(..., min_length=3, max_length=254)
    pin: str = Field(..., min_length=6, max_length=6)


class VerifyPinResponse(BaseModel):
    success: bool
    error: str | None = None


class SendPinResponse(BaseModel):
    success: bool
    error: str | None = None


class CheckEmailRequest(BaseModel):
    """Incoming payload for POST /api/auth/check-email."""

    email: str = Field(..., min_length=3, max_length=254)


class CheckEmailResponse(BaseModel):
    exists: bool


class SignupRequest(BaseModel):
    """Incoming payload for POST /api/auth/signup."""

    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=256)


class SignupResponse(BaseModel):
    success: bool
    error: str | None = None


# ─── Courses ────────────────────────────────────────────────────────────────

class CourseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    status: str = Field(..., pattern="^(shelf|enrolled|in-progress|completed)$")
    category: str | None = Field(default=None, max_length=100)
    hasCertificate: bool = Field(default=False)


class CourseItem(CourseCreate):
    id: str
    createdAt: str
    updatedAt: str


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = Field(default=None, pattern="^(shelf|enrolled|in-progress|completed)$")
    category: str | None = Field(default=None, max_length=100)
    hasCertificate: bool | None = Field(default=None)


# ─── Library Items ────────────────────────────────────────────────────────────

class LibraryItemCreate(BaseModel):
    courseId: str = Field(..., min_length=1, max_length=200)
    courseName: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., pattern="^(pdf|url)$")
    content: str = Field(..., min_length=1)  # base64 data URI for PDFs, plain URL for links


class LibraryItem(LibraryItemCreate):
    id: str
    createdAt: str
    updatedAt: str


# ─── Course Notes ─────────────────────────────────────────────────────────────

class CourseNoteUpsert(BaseModel):
    """Payload to create or overwrite a note for a course (one note per course)."""

    content: str = Field(default="")


class CourseNoteItem(BaseModel):
    """Stored note returned to the client."""

    courseId: str
    content: str
    updatedAt: str
