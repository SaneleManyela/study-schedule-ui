"""Firestore data access helpers for study schedules and study plans."""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

from .models import ScheduleCreate, ScheduleItem, StudyPlanCreate, StudyPlanItem


def _parse_iso_datetime(value: str) -> datetime:
    """Parse an ISO datetime string and normalize it to UTC."""

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _to_iso(value: Any) -> str:
    """Convert Firestore timestamp-like objects to ISO-8601 strings."""

    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return datetime.now(UTC).isoformat()


def _get_firestore_client() -> firestore.Client:
    """Initialize Firebase Admin app and return Firestore client."""

    if not firebase_admin._apps:
        project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()

        if service_account_json:
            creds = credentials.Certificate(json.loads(service_account_json))
            firebase_admin.initialize_app(creds, options={"projectId": project_id} if project_id else None)
        else:
            firebase_admin.initialize_app(options={"projectId": project_id} if project_id else None)

    return firestore.client()


def list_schedules() -> list[ScheduleItem]:
    """Fetch all schedule entries ordered by start time."""

    client = _get_firestore_client()
    docs = client.collection("schedules").order_by("startAt").stream()

    items: list[ScheduleItem] = []
    for doc in docs:
        data = doc.to_dict() or {}
        items.append(
            ScheduleItem(
                id=doc.id,
                title=str(data.get("title", "")),
                description=str(data.get("description", "")),
                startAt=_to_iso(data.get("startAt")),
                endAt=_to_iso(data.get("endAt")),
                createdAt=_to_iso(data.get("createdAt")),
                updatedAt=_to_iso(data.get("updatedAt")),
            )
        )
    return items


def create_schedule(payload: ScheduleCreate) -> ScheduleItem:
    """Create a new schedule entry in Firestore."""

    client = _get_firestore_client()
    now = datetime.now(UTC)
    start_at = _parse_iso_datetime(payload.startAt)
    end_at = _parse_iso_datetime(payload.endAt)

    doc_ref = client.collection("schedules").document()
    doc_ref.set(
        {
            "title": payload.title.strip(),
            "description": payload.description.strip(),
            "startAt": start_at,
            "endAt": end_at,
            "createdAt": now,
            "updatedAt": now,
        }
    )
    data = doc_ref.get().to_dict() or {}
    return ScheduleItem(
        id=doc_ref.id,
        title=str(data.get("title", payload.title.strip())),
        description=str(data.get("description", payload.description.strip())),
        startAt=_to_iso(data.get("startAt", start_at)),
        endAt=_to_iso(data.get("endAt", end_at)),
        createdAt=_to_iso(data.get("createdAt", now)),
        updatedAt=_to_iso(data.get("updatedAt", now)),
    )


def list_study_plans() -> list[StudyPlanItem]:
    """Fetch all study plan entries ordered by session date."""

    client = _get_firestore_client()
    docs = client.collection("study_plans").order_by("sessionDate").stream()

    items: list[StudyPlanItem] = []
    for doc in docs:
        data = doc.to_dict() or {}
        items.append(
            StudyPlanItem(
                id=doc.id,
                title=str(data.get("title", "")),
                goal=str(data.get("goal", "")),
                sessionDate=str(data.get("sessionDate", "")),
                durationMinutes=int(data.get("durationMinutes", 0)),
                notes=str(data.get("notes", "")),
                createdAt=_to_iso(data.get("createdAt")),
                updatedAt=_to_iso(data.get("updatedAt")),
            )
        )
    return items


def create_study_plan(payload: StudyPlanCreate) -> StudyPlanItem:
    """Create a new study plan entry in Firestore."""

    client = _get_firestore_client()
    now = datetime.now(UTC)

    doc_ref = client.collection("study_plans").document()
    doc_ref.set(
        {
            "title": payload.title.strip(),
            "goal": payload.goal.strip(),
            "sessionDate": payload.sessionDate,
            "durationMinutes": payload.durationMinutes,
            "notes": payload.notes.strip(),
            "createdAt": now,
            "updatedAt": now,
        }
    )
    data = doc_ref.get().to_dict() or {}
    return StudyPlanItem(
        id=doc_ref.id,
        title=str(data.get("title", payload.title.strip())),
        goal=str(data.get("goal", payload.goal.strip())),
        sessionDate=str(data.get("sessionDate", payload.sessionDate)),
        durationMinutes=int(data.get("durationMinutes", payload.durationMinutes)),
        notes=str(data.get("notes", payload.notes.strip())),
        createdAt=_to_iso(data.get("createdAt", now)),
        updatedAt=_to_iso(data.get("updatedAt", now)),
    )