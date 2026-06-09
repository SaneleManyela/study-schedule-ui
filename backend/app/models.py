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


class StudyPlanItem(StudyPlanCreate):
    """Stored study plan entry returned to the client."""

    id: str
    createdAt: str
    updatedAt: str