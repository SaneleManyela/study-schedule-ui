"""Firestore data access helpers for study schedules and study plans."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import threading
import time
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

from .models import ScheduleCreate, ScheduleItem, StudyPlanCreate, StudyPlanItem, SendPinResponse, VerifyPasswordResponse, VerifyPinResponse, CourseCreate, CourseItem, CourseUpdate, LibraryItemCreate, LibraryItem, CourseNoteUpsert, CourseNoteItem, CheckEmailResponse, SignupResponse


# ---------------------------------------------------------------------------
# Thread-safe in-memory TTL cache  (no extra dependencies)
# ---------------------------------------------------------------------------

class _TTLCache:
    """Minimal thread-safe key/value cache with per-entry TTL."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> tuple[Any, bool]:
        """Return (value, hit). Expired entries are evicted on read."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None, False
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None, False
            return value, True

    def set(self, key: str, value: Any, ttl: float) -> None:
        with self._lock:
            self._store[key] = (value, time.monotonic() + ttl)

    def delete(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._store.pop(key, None)

    def delete_prefix(self, prefix: str) -> None:
        with self._lock:
            for key in [k for k in self._store if k.startswith(prefix)]:
                del self._store[key]


_cache = _TTLCache()

# TTL constants (seconds)
_TTL_LIST   = 30   # schedules, study-plans, notes  — change frequently
_TTL_STATIC = 60   # courses, library               — change less often


# ---------------------------------------------------------------------------
# Password hashing helpers (PBKDF2-HMAC-SHA256, built-in, no extra deps)
# ---------------------------------------------------------------------------

def _hash_password(password: str) -> str:
    """Return a salted PBKDF2 hash string: 'pbkdf2:<salt_hex>:<hash_hex>'."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"pbkdf2:{salt}:{dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored hash or legacy plaintext."""
    if stored.startswith("pbkdf2:"):
        _, salt, expected = stored.split(":", 2)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return secrets.compare_digest(dk.hex(), expected)
    # Legacy plaintext comparison for existing admin docs
    return secrets.compare_digest(password, stored)


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


# Cached singleton — avoids re-creating the gRPC channel on every request
_firestore_client: firestore.Client | None = None


def _get_firestore_client() -> firestore.Client:
    """Initialize Firebase Admin app once and return the cached Firestore client."""
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client

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

    _firestore_client = firestore.client()
    return _firestore_client


# ---------------------------------------------------------------------------
# Auth helpers (password / PIN via Firestore passwords collection)
# ---------------------------------------------------------------------------

def _get_admin_doc(email: str):
    """Return the Auth document matching the given email, or None."""
    client = _get_firestore_client()
    snapshot = client.collection("Auth").where(filter=firestore.FieldFilter("email", "==", email)).limit(1).get()
    if not snapshot:
        return None
    return snapshot[0]


def verify_admin_password(password: str, email: str) -> VerifyPasswordResponse:
    """Check the supplied password against the Firestore admin config."""
    try:
        doc = _get_admin_doc(email)
        if doc is None:
            return VerifyPasswordResponse(success=False, error="Admin config not found")
        data = doc.to_dict() or {}
        stored = data.get("password", "")
        if _verify_password(password, stored):
            return VerifyPasswordResponse(success=True)
        return VerifyPasswordResponse(success=False, error="Incorrect password")
    except Exception as exc:  # noqa: BLE001
        return VerifyPasswordResponse(success=False, error=str(exc))


def check_admin_email(email: str) -> CheckEmailResponse:
    """Return whether an Auth document exists for the given email."""
    try:
        doc = _get_admin_doc(email)
        return CheckEmailResponse(exists=doc is not None)
    except Exception:  # noqa: BLE001
        return CheckEmailResponse(exists=False)


def signup_admin(email: str, password: str) -> SignupResponse:
    """Create a new admin account in Firestore (email must not already exist)."""
    try:
        existing = _get_admin_doc(email)
        if existing is not None:
            return SignupResponse(success=False, error="An account with this email already exists.")
        client = _get_firestore_client()
        now = datetime.now(UTC)
        client.collection("Auth").document().set({
            "email": email.strip().lower(),
            "password": _hash_password(password),
            "createdAt": now.isoformat(),
            "updatedAt": now.isoformat(),
        })
        return SignupResponse(success=True)
    except Exception as exc:  # noqa: BLE001
        return SignupResponse(success=False, error=str(exc))


def send_admin_pin(email: str) -> SendPinResponse:
    """Generate a 6-digit PIN, store it in Firestore, and e-mail it via SMTP (or Resend fallback)."""
    try:
        doc = _get_admin_doc(email)
        if doc is None:
            return SendPinResponse(success=False, error="Admin config not found")
        if not email:
            return SendPinResponse(success=False, error="No email provided")

        pin = "".join(random.choices(string.digits, k=6))
        # Store PIN with 10-minute expiry
        expires_dt = datetime.now(UTC).timestamp() + 600
        doc.reference.set(
            {"pin": pin, "pinExpiresAt": datetime.fromtimestamp(expires_dt, UTC).isoformat(), "updatedAt": datetime.now(UTC).isoformat()},
            merge=True,
        )

        resend_key = os.getenv("RESEND_API_KEY", "").strip()
        smtp_user = os.getenv("SMTP_USER", "").strip()
        smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()

        if smtp_user and smtp_pass:
            # ── Gmail SMTP (primary) ────────────────────────────────────────
            msg = MIMEText(f"Your Study Planner admin PIN is: {pin}\n\nThis PIN expires in 10 minutes.")
            msg["Subject"] = "Study Planner Admin PIN"
            msg["From"] = smtp_user
            msg["To"] = email
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [email], msg.as_string())
        elif resend_key:
            # ── Resend API (fallback) ───────────────────────────────────────
            import urllib.request
            import json as _json
            payload = _json.dumps({
                "from": "Study Planner <onboarding@resend.dev>",
                "to": [email],
                "subject": "Study Planner Admin PIN",
                "text": f"Your Study Planner admin PIN is: {pin}\n\nThis PIN expires in 10 minutes.",
            }).encode()
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=payload,
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req) as resp:
                if resp.status not in (200, 201):
                    raise RuntimeError(f"Resend returned HTTP {resp.status}")
        else:
            # Dev fallback: print PIN to backend console
            print(f"[DEV] Admin PIN for {email}: {pin}")

        return SendPinResponse(success=True)
    except Exception as exc:  # noqa: BLE001
        return SendPinResponse(success=False, error=str(exc))


def verify_admin_pin(pin: str, email: str) -> VerifyPinResponse:
    """Validate the submitted PIN against the stored Firestore value."""
    try:
        doc = _get_admin_doc(email)
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
    cached, hit = _cache.get("schedules:all")
    if hit:
        return cached

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
    _cache.set("schedules:all", items, _TTL_LIST)
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
    _cache.delete("schedules:all")
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
    cached, hit = _cache.get("study_plans:all")
    if hit:
        return cached

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
    _cache.set("study_plans:all", items, _TTL_LIST)
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
    _cache.delete("study_plans:all")
    _cache.delete("study_plans:all")
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


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

def list_courses() -> list[CourseItem]:
    """Fetch all courses ordered by name."""
    cached, hit = _cache.get("courses:all")
    if hit:
        return cached
    client = _get_firestore_client()
    docs = client.collection("courses").order_by("name").stream()
    items: list[CourseItem] = []
    for doc in docs:
        data = doc.to_dict() or {}
        items.append(CourseItem(
            id=doc.id,
            name=str(data.get("name", "")),
            status=str(data.get("status", "shelf")),
            category=str(data.get("category")) if data.get("category") else None,
            hasCertificate=bool(data.get("hasCertificate", False)),
            createdAt=_to_iso(data.get("createdAt")),
            updatedAt=_to_iso(data.get("updatedAt")),
        ))
    _cache.set("courses:all", items, _TTL_STATIC)
    return items


def create_course(payload: CourseCreate) -> CourseItem:
    """Create a course in Firestore."""
    _cache.delete("courses:all")
    client = _get_firestore_client()
    now = datetime.now(UTC)
    doc_ref = client.collection("courses").document()
    doc_ref.set({
        "name": payload.name.strip(),
        "status": payload.status,
        "category": payload.category.strip() if payload.category else None,
        "hasCertificate": payload.hasCertificate,
        "createdAt": now,
        "updatedAt": now,
    })
    return CourseItem(
        id=doc_ref.id,
        name=payload.name.strip(),
        status=payload.status,
        category=payload.category.strip() if payload.category else None,
        hasCertificate=payload.hasCertificate,
        createdAt=now.isoformat(),
        updatedAt=now.isoformat(),
    )


def update_course(course_id: str, payload: CourseUpdate) -> CourseItem:
    """Update a course document in Firestore."""
    _cache.delete("courses:all")
    client = _get_firestore_client()
    now = datetime.now(UTC)
    doc_ref = client.collection("courses").document(course_id)
    updates: dict = {"updatedAt": now}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.status is not None:
        updates["status"] = payload.status
    if payload.category is not None:
        updates["category"] = payload.category.strip()
    if payload.hasCertificate is not None:
        updates["hasCertificate"] = payload.hasCertificate
    doc_ref.set(updates, merge=True)
    data = doc_ref.get().to_dict() or {}
    return CourseItem(
        id=course_id,
        name=str(data.get("name", "")),
        status=str(data.get("status", "shelf")),
        category=str(data.get("category")) if data.get("category") else None,
        hasCertificate=bool(data.get("hasCertificate", False)),
        createdAt=_to_iso(data.get("createdAt")),
        updatedAt=_to_iso(data.get("updatedAt")),
    )


def delete_course(course_id: str) -> None:
    """Delete a course from Firestore."""
    _cache.delete("courses:all")
    client = _get_firestore_client()
    client.collection("courses").document(course_id).delete()


# ---------------------------------------------------------------------------
# Library Items
# ---------------------------------------------------------------------------

def list_library_items() -> list[LibraryItem]:
    """Fetch all library items ordered by title."""
    cached, hit = _cache.get("library:all")
    if hit:
        return cached
    client = _get_firestore_client()
    docs = client.collection("library").order_by("title").stream()
    items: list[LibraryItem] = []
    for doc in docs:
        data = doc.to_dict() or {}
        items.append(LibraryItem(
            id=doc.id,
            courseId=str(data.get("courseId", "")),
            courseName=str(data.get("courseName", "")),
            title=str(data.get("title", "")),
            type=str(data.get("type", "pdf")),
            content=str(data.get("content", "")),
            createdAt=_to_iso(data.get("createdAt")),
            updatedAt=_to_iso(data.get("updatedAt")),
        ))
    _cache.set("library:all", items, _TTL_STATIC)
    return items


def create_library_item(payload: LibraryItemCreate) -> LibraryItem:
    """Store a library item in Firestore."""
    _cache.delete("library:all")
    client = _get_firestore_client()
    now = datetime.now(UTC)
    doc_ref = client.collection("library").document()
    doc_ref.set({
        "courseId": payload.courseId,
        "courseName": payload.courseName,
        "title": payload.title.strip(),
        "type": payload.type,
        "content": payload.content,
        "createdAt": now,
        "updatedAt": now,
    })
    return LibraryItem(
        id=doc_ref.id,
        courseId=payload.courseId,
        courseName=payload.courseName,
        title=payload.title.strip(),
        type=payload.type,
        content=payload.content,
        createdAt=now.isoformat(),
        updatedAt=now.isoformat(),
    )


def delete_library_item(item_id: str) -> None:
    """Delete a library item from Firestore."""
    _cache.delete("library:all")
    client = _get_firestore_client()
    client.collection("library").document(item_id).delete()


# ---------------------------------------------------------------------------
# Course Notes  (one note document per course, stored in "course-notes" collection)
# ---------------------------------------------------------------------------

def get_course_note(course_id: str) -> CourseNoteItem | None:
    """Return the note for a course, or None if it doesn't exist."""
    cache_key = f"note:{course_id}"
    cached, hit = _cache.get(cache_key)
    if hit:
        return cached
    client = _get_firestore_client()
    doc = client.collection("course-notes").document(course_id).get()
    if not doc.exists:
        _cache.set(cache_key, None, _TTL_LIST)
        return None
    data = doc.to_dict() or {}
    result = CourseNoteItem(
        courseId=course_id,
        content=str(data.get("content", "")),
        updatedAt=_to_iso(data.get("updatedAt")),
    )
    _cache.set(cache_key, result, _TTL_LIST)
    return result


def upsert_course_note(course_id: str, payload: CourseNoteUpsert) -> CourseNoteItem:
    """Create or overwrite the note for a course."""
    _cache.delete(f"note:{course_id}")
    client = _get_firestore_client()
    now = datetime.now(UTC)
    client.collection("course-notes").document(course_id).set(
        {"content": payload.content, "updatedAt": now},
        merge=False,
    )
    return CourseNoteItem(
        courseId=course_id,
        content=payload.content,
        updatedAt=now.isoformat(),
    )