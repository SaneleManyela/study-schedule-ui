"""Firestore data access helpers for study schedules and study plans."""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import Any
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

import math
import random
import re
import smtplib
import string
from email.mime.text import MIMEText

from .models import ScheduleCreate, ScheduleItem, StudyPlanCreate, StudyPlanItem, SendPinResponse, VerifyPasswordResponse, VerifyPinResponse


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
        service_account_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()

        if service_account_json:
            creds = credentials.Certificate(json.loads(service_account_json))
            firebase_admin.initialize_app(creds, options={"projectId": project_id} if project_id else None)
        elif service_account_path:
            path = Path(service_account_path)
            if not path.exists():
                raise RuntimeError(
                    "GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist: "
                    f"{service_account_path}"
                )

            firebase_admin.initialize_app(
                credentials.Certificate(str(path)),
                options={"projectId": project_id} if project_id else None,
            )
        else:
            raise RuntimeError(
                "Firebase is not configured. Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file path "
                "or set FIREBASE_SERVICE_ACCOUNT_JSON with the raw JSON content."
            )

    return firestore.client()


# ---------------------------------------------------------------------------
# Auth helpers (password / PIN via Firestore passwords collection)
# ---------------------------------------------------------------------------

def _get_admin_doc():
    """Return the first document in the passwords collection or None."""
    client = _get_firestore_client()
    snapshot = client.collection("password").limit(1).get()
    if not snapshot:
        return None
    return snapshot[0]


def verify_admin_password(password: str) -> VerifyPasswordResponse:
    """Check the supplied password against the Firestore admin config."""
    try:
        doc = _get_admin_doc()
        if doc is None:
            return VerifyPasswordResponse(success=False, error="Admin config not found")
        data = doc.to_dict() or {}
        stored = data.get("password", "")
        if password == stored:
            return VerifyPasswordResponse(success=True)
        return VerifyPasswordResponse(success=False, error="Incorrect password")
    except Exception as exc:  # noqa: BLE001
        return VerifyPasswordResponse(success=False, error=str(exc))


def send_admin_pin() -> SendPinResponse:
    """Generate a 6-digit PIN, store it in Firestore, and e-mail it via Gmail SMTP."""
    try:
        doc = _get_admin_doc()
        if doc is None:
            return SendPinResponse(success=False, error="Admin config not found")
        data = doc.to_dict() or {}
        email = data.get("email", "").strip()
        if not email:
            return SendPinResponse(success=False, error="No email configured in passwords collection")

        pin = "".join(random.choices(string.digits, k=6))
        pin_expires_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        # Store for 10 minutes
        expires_dt = datetime.now(UTC).timestamp() + 600
        doc.reference.set(
            {"pin": pin, "pinExpiresAt": datetime.fromtimestamp(expires_dt, UTC).isoformat(), "updatedAt": datetime.now(UTC).isoformat()},
            merge=True,
        )

        # Send via Gmail SMTP using env vars
        smtp_user = os.getenv("SMTP_USER", "").strip()
        smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
        if smtp_user and smtp_pass:
            msg = MIMEText(f"Your Study Planner admin PIN is: {pin}\n\nThis PIN expires in 10 minutes.")
            msg["Subject"] = "Study Planner Admin PIN"
            msg["From"] = smtp_user
            msg["To"] = email
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [email], msg.as_string())
        else:
            # Dev fallback: print PIN to backend console so local testing works
            print(f"[DEV] Admin PIN for {email}: {pin}")

        return SendPinResponse(success=True)
    except Exception as exc:  # noqa: BLE001
        return SendPinResponse(success=False, error=str(exc))


def verify_admin_pin(pin: str) -> VerifyPinResponse:
    """Validate the submitted PIN against the stored Firestore value."""
    try:
        doc = _get_admin_doc()
        if doc is None:
            return VerifyPinResponse(success=False, error="Admin config not found")
        data = doc.to_dict() or {}
        stored_pin = data.get("pin", "")
        expires_at_str = data.get("pinExpiresAt", "")
        if not stored_pin or not expires_at_str:
            return VerifyPinResponse(success=False, error="No PIN has been generated")
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if datetime.now(UTC) > expires_at:
            return VerifyPinResponse(success=False, error="PIN has expired")
        if pin != stored_pin:
            return VerifyPinResponse(success=False, error="Incorrect PIN")
        doc.reference.set({"pin": None, "pinExpiresAt": None}, merge=True)
        return VerifyPinResponse(success=True)
    except Exception as exc:  # noqa: BLE001
        return VerifyPinResponse(success=False, error=str(exc))


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
                resourceTitle=str(data.get("resourceTitle")) if data.get("resourceTitle") is not None else None,
                resourceUrl=str(data.get("resourceUrl")) if data.get("resourceUrl") is not None else None,
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
            "resourceTitle": payload.resourceTitle.strip() if payload.resourceTitle else None,
            "resourceUrl": payload.resourceUrl.strip() if payload.resourceUrl else None,
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
        resourceTitle=str(data.get("resourceTitle")) if data.get("resourceTitle") is not None else payload.resourceTitle,
        resourceUrl=str(data.get("resourceUrl")) if data.get("resourceUrl") is not None else payload.resourceUrl,
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
                resourceTitle=str(data.get("resourceTitle")) if data.get("resourceTitle") is not None else None,
                resourceUrl=str(data.get("resourceUrl")) if data.get("resourceUrl") is not None else None,
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
            "resourceTitle": payload.resourceTitle.strip() if payload.resourceTitle else None,
            "resourceUrl": payload.resourceUrl.strip() if payload.resourceUrl else None,
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
        resourceTitle=str(data.get("resourceTitle")) if data.get("resourceTitle") is not None else payload.resourceTitle,
        resourceUrl=str(data.get("resourceUrl")) if data.get("resourceUrl") is not None else payload.resourceUrl,
        createdAt=_to_iso(data.get("createdAt", now)),
        updatedAt=_to_iso(data.get("updatedAt", now)),
    )