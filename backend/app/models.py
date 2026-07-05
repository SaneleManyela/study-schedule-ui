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
    token: str | None = None  # Opaque session token returned on successful PIN verification
    role: str | None = None   # "admin" | "user" — tells the frontend which UI to show


class SendPinResponse(BaseModel):
    success: bool
    error: str | None = None


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


# ─── Categories ───────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class CategoryItem(BaseModel):
    id: str
    name: str
    createdAt: str
    updatedAt: str


class CategoryUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


# ─── Languages ────────────────────────────────────────────────────────────────

_LEVEL_RE = "^(Beginner|Elementary|Intermediate|Upper-Intermediate|Advanced|Fluent|Native)$"


class LanguageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    level: str = Field(default="Beginner", pattern=_LEVEL_RE)


class LanguageItem(BaseModel):
    id: str
    name: str
    level: str
    createdAt: str
    updatedAt: str


class LanguageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    level: str | None = Field(default=None, pattern=_LEVEL_RE)


# ─── Library Items ────────────────────────────────────────────────────────────

class LibraryItemCreate(BaseModel):
    courseId: str = Field(..., min_length=1, max_length=200)
    courseName: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., pattern="^(pdf|url|gdrive)$")
    content: str = Field(..., min_length=1)  # base64 data URI for PDFs, plain URL for links, embed URL for gdrive

class LibraryItemUpdate(BaseModel):
    """Partial update for a library item. Omit fields to leave them unchanged.
    To replace PDF content supply a new base64 data URI; for URLs supply a new URL."""
    courseId: str | None = Field(default=None, min_length=1, max_length=200)
    courseName: str | None = Field(default=None, min_length=1, max_length=200)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    type: str | None = Field(default=None, pattern="^(pdf|url|gdrive)$")
    content: str | None = Field(default=None, min_length=1)


class LibraryItem(LibraryItemCreate):
    id: str
    createdAt: str
    updatedAt: str
    # Overrides the min_length=1 from LibraryItemCreate — content may be empty
    # in list responses where PDF base64 is stripped to keep payloads small.
    content: str = Field(default="")


# ─── Course Notes ─────────────────────────────────────────────────────────────

class CourseNoteUpsert(BaseModel):
    """Payload to create or overwrite a note for a course (one note per course)."""

    content: str = Field(default="")


class CourseNoteItem(BaseModel):
    """Stored note returned to the client."""

    courseId: str
    content: str
    updatedAt: str
