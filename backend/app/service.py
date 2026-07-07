"""Firestore data access helpers for study schedules and study plans."""

from __future__ import annotations

import hashlib
import hmac as _hmac_mod
import json
import os
import secrets
import threading
import time
from datetime import UTC, datetime
from typing import Any
from pathlib import Path

# ── GLOBAL SOCKET MONKEY-PATCH FOR RENDER NETWORKING ────────────────────────
# This must be executed at module load time to force Python's network engine
# to exclusively resolve and connect over IPv4 (AF_INET), completely bypassing
# Render's unreachable IPv6 interfaces for SMTP, Firestore, and Resend.
import socket
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_only_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = _ipv4_only_getaddrinfo
# ───────────────────────────────────────────────────────────────────────────

import firebase_admin
from firebase_admin import credentials, firestore

import base64
import logging
import math
import re
import requests
import smtplib
import string
from email.mime.text import MIMEText

from .models import ScheduleCreate, ScheduleItem, StudyPlanCreate, StudyPlanItem, SendPinResponse, VerifyPasswordResponse, VerifyPinResponse, CourseCreate, CourseItem, CourseUpdate, LibraryItemCreate, LibraryItemUpdate, LibraryItem, CourseNoteUpsert, CourseNoteItem, CheckEmailResponse, SignupResponse


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
# Session token (HMAC-SHA256 signed, 8-hour TTL)
# Read from SESSION_SECRET env var so tokens survive Cloud Run cold-starts.
# Falls back to a random key in development (all sessions end on restart).
# ---------------------------------------------------------------------------

_SESSION_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
_SESSION_TTL = 8 * 3600  # 8 hours


def _generate_session_token(email: str, role: str) -> str:
    """Return a signed opaque token: b64url(email):b64url(role):expires_ts:hmac."""
    b64_email = base64.urlsafe_b64encode(email.encode()).decode().rstrip("=")
    b64_role  = base64.urlsafe_b64encode(role.encode()).decode().rstrip("=")
    expires_ts = int(time.time()) + _SESSION_TTL
    payload = f"{b64_email}:{b64_role}:{expires_ts}"
    sig = _hmac_mod.new(_SESSION_SECRET.encode(), payload.encode(), "sha256").hexdigest()
    return f"{payload}:{sig}"


def validate_session_token(token: str) -> dict[str, str] | None:
    """Return {"email": ..., "role": ...} for a valid non-expired token, or None."""
    try:
        parts = token.split(":", 3)
        if len(parts) != 4:
            return None
        b64_email, b64_role, expires_ts_str, sig = parts
        payload = f"{b64_email}:{b64_role}:{expires_ts_str}"
        expected = _hmac_mod.new(_SESSION_SECRET.encode(), payload.encode(), "sha256").hexdigest()
        if not secrets.compare_digest(sig, expected):
            return None
        if time.time() > int(expires_ts_str):
            return None

        def _b64d(s: str) -> str:
            return base64.urlsafe_b64decode(s + "=" * ((4 - len(s) % 4) % 4)).decode()

        return {"email": _b64d(b64_email), "role": _b64d(b64_role)}
    except Exception:
        return None


# ---------------------------------------------------------------------------
# PIN brute-force protection (in-memory, per-email sliding window)
# ---------------------------------------------------------------------------

_pin_attempts: dict[str, list[float]] = {}   # email -> list of failed attempt timestamps
_pin_lock = threading.Lock()
_PIN_MAX_ATTEMPTS = 5
_PIN_WINDOW_SECONDS = 600  # 10 minutes


def _record_failed_pin(email: str) -> bool:
    """Record a failed PIN attempt. Returns False if the account is now rate-limited."""
    now = time.monotonic()
    cutoff = now - _PIN_WINDOW_SECONDS
    with _pin_lock:
        recent = [t for t in _pin_attempts.get(email, []) if t > cutoff]
        recent.append(now)
        _pin_attempts[email] = recent
        return len(recent) <= _PIN_MAX_ATTEMPTS


def _is_pin_rate_limited(email: str) -> bool:
    now = time.monotonic()
    cutoff = now - _PIN_WINDOW_SECONDS
    with _pin_lock:
        recent = [t for t in _pin_attempts.get(email, []) if t > cutoff]
        _pin_attempts[email] = recent
        return len(recent) >= _PIN_MAX_ATTEMPTS


def _clear_pin_attempts(email: str) -> None:
    with _pin_lock:
        _pin_attempts.pop(email, None)


# ── password verify rate-limiter (5 fails / 10 min per email) ─────────────────
_pw_attempts: dict[str, list[float]] = {}
_pw_lock = threading.Lock()


def _record_failed_password_attempt(email: str) -> None:
    now = time.monotonic()
    with _pw_lock:
        recent = [t for t in _pw_attempts.get(email, []) if t > now - _PIN_WINDOW_SECONDS]
        recent.append(now)
        _pw_attempts[email] = recent


def _is_password_rate_limited(email: str) -> bool:
    now = time.monotonic()
    cutoff = now - _PIN_WINDOW_SECONDS
    with _pw_lock:
        recent = [t for t in _pw_attempts.get(email, []) if t > cutoff]
        _pw_attempts[email] = recent
        return len(recent) >= _PIN_MAX_ATTEMPTS


# ── send-pin rate-limiter (3 sends / 10 min per email) ────────────────────────
_sendpin_attempts: dict[str, list[float]] = {}
_sendpin_lock = threading.Lock()
_SENDPIN_MAX = 3


def _record_failed_sendpin_attempt(email: str) -> None:
    now = time.monotonic()
    with _sendpin_lock:
        recent = [t for t in _sendpin_attempts.get(email, []) if t > now - _PIN_WINDOW_SECONDS]
        recent.append(now)
        _sendpin_attempts[email] = recent


def _is_sendpin_rate_limited(email: str) -> bool:
    now = time.monotonic()
    cutoff = now - _PIN_WINDOW_SECONDS
    with _sendpin_lock:
        recent = [t for t in _sendpin_attempts.get(email, []) if t > cutoff]
        _sendpin_attempts[email] = recent
        return len(recent) >= _SENDPIN_MAX


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

    # Only initialize if no default app exists yet (handles hot-reload safely)
    if not firebase_admin._apps:
        project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        service_account_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()

        # Build service account from individual env vars if full JSON not provided or incomplete
        if not service_account_json and not service_account_path:
            # Try to build from individual env vars
            client_email = os.getenv("FIREBASE_CLIENT_EMAIL", "").strip()
            private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").strip()
            private_key_id = os.getenv("FIREBASE_PRIVATE_KEY_ID", "").strip()
            client_id = os.getenv("FIREBASE_CLIENT_ID", "").strip()
            
            if client_email and private_key and project_id:
                # Construct a minimal service account dict from individual env vars
                # The private key may have escaped newlines in env vars
                private_key = private_key.replace("\\n", "\n")
                service_account_json = json.dumps({
                    "type": "service_account",
                    "project_id": project_id,
                    "private_key_id": private_key_id,
                    "client_email": client_email,
                    "client_id": client_id,
                    "private_key": private_key,
                    "token_uri": "https://oauth2.googleapis.com/token",
                })
        elif service_account_json:
            # Validate that the provided JSON has all required fields
            try:
                parsed_json = json.loads(service_account_json)
                required_fields = ["type", "project_id", "private_key_id", "private_key", "client_email", "token_uri"]
                missing = [f for f in required_fields if f not in parsed_json]
                if missing:
                    # Fall back to individual env vars if JSON is incomplete
                    service_account_json = ""
                    client_email = os.getenv("FIREBASE_CLIENT_EMAIL", "").strip()
                    private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").strip()
                    private_key_id = os.getenv("FIREBASE_PRIVATE_KEY_ID", "").strip()
                    client_id = os.getenv("FIREBASE_CLIENT_ID", "").strip()
                    
                    if client_email and private_key and project_id:
                        private_key = private_key.replace("\\n", "\n")
                        service_account_json = json.dumps({
                            "type": "service_account",
                            "project_id": project_id,
                            "private_key_id": private_key_id,
                            "client_email": client_email,
                            "client_id": client_id,
                            "private_key": private_key,
                            "token_uri": "https://oauth2.googleapis.com/token",
                        })
            except json.JSONDecodeError:
                service_account_json = ""

        try:
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
        except ValueError as exc:
            # "The default Firebase app already exists" — safe to ignore on hot-reload.
            if "already exists" not in str(exc):
                raise

    # Reuse the existing app (works both on first init and after hot-reload)
    _firestore_client = firestore.client(app=firebase_admin.get_app())
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
        logging.exception("verify_admin_password failed")
        return VerifyPasswordResponse(success=False, error="A server error occurred. Try again.")


def check_admin_email(email: str) -> CheckEmailResponse:
    """Return whether an Auth document exists for the given email."""
    try:
        doc = _get_admin_doc(email)
        return CheckEmailResponse(exists=doc is not None)
    except Exception as exc:  # noqa: BLE001
        logging.exception("check_admin_email failed: %s", exc)
        # Return the error message for debugging (remove in production if needed)
        return CheckEmailResponse(exists=False, error=str(exc) if str(exc) else "Unknown error")


def signup_admin(email: str, password: str) -> SignupResponse:
    """Create a new admin account in Firestore (email must not already exist)."""
    import hashlib as _hashlib
    try:
        doc_id = _hashlib.sha256(email.strip().lower().encode()).hexdigest()
        client = _get_firestore_client()
        doc_ref = client.collection("Auth").document(doc_id)
        now = datetime.now(UTC)
        try:
            doc_ref.create({
                "email": email.strip().lower(),
                "password": _hash_password(password),
                "role": "admin",
                "createdAt": now.isoformat(),
                "updatedAt": now.isoformat(),
            })
        except Exception as conflict_exc:
            err_str = str(conflict_exc).lower()
            if "already exists" in err_str or "conflict" in err_str or "409" in err_str:
                return SignupResponse(success=False, error="An account with this email already exists.")
            raise
        return SignupResponse(success=True)
    except Exception as exc:  # noqa: BLE001
        logging.exception("signup_admin failed")
        return SignupResponse(success=False, error="A server error occurred. Try again.")


def send_admin_pin(email: str) -> SendPinResponse:
    """Generate a 6-digit PIN, store it in Firestore, and e-mail it via SMTP (or Resend fallback)."""
    try:
        doc = _get_admin_doc(email)
        if doc is None:
            return SendPinResponse(success=False, error="Admin config not found")
        if not email:
            return SendPinResponse(success=False, error="No email provided")

        pin = "".join(secrets.choice(string.digits) for _ in range(6))
        expires_dt = datetime.now(UTC).timestamp() + 600
        doc.reference.set(
            {"pin": pin, "pinExpiresAt": datetime.fromtimestamp(expires_dt, UTC).isoformat(), "updatedAt": datetime.now(UTC).isoformat()},
            merge=True,
        )

        resend_key = os.getenv("RESEND_API_KEY", "").strip()
        smtp_user = os.getenv("SMTP_USER", "").strip()
        smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
        smtp_port = int(os.getenv("SMTP_PORT", "465").strip())

        if smtp_user and smtp_pass:
            # ── Configurable SMTP (primary) ───────────────────────────────────
            msg = MIMEText(f"Your Study Planner admin PIN is: {pin}\n\nThis PIN expires in 10 minutes.")
            msg["Subject"] = "Study Planner Admin PIN"
            msg["From"] = smtp_user
            msg["To"] = email
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [email], msg.as_string())
        elif resend_key:
            # ── Resend API (fallback) ───────────────────────────────────────
            import urllib.request
            import urllib.error
            import json as _json
            logging.info(f"RESEND_API_KEY length: {len(resend_key)}, starts with: {resend_key[:10] if resend_key else 'EMPTY'}")
            payload = _json.dumps({
                "from": "onboarding@resend.dev",
                "to": [email],
                "subject": "Study Planner Admin PIN",
                "text": f"Your Study Planner admin PIN is: {pin}\n\nThis PIN expires in 10 minutes.",
            }).encode()
            req = urllib.request.Request(
                "https://api-us.resend.com/emails",  # Forces IPv4 compatible endpoint
                data=payload,
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status not in (200, 201):
                        error_body = resp.read().decode()
                        raise RuntimeError(f"Resend returned HTTP {resp.status}: {error_body}")
            except urllib.error.HTTPError as http_err:
                error_body = http_err.read().decode()
                raise RuntimeError(f"Resend API error: {error_body}")
        else:
            print(f"[DEV] Admin PIN for {email}: {pin}")

        return SendPinResponse(success=True)
    except Exception as exc:  # noqa: BLE001
        logging.exception("send_admin_pin failed")
        return SendPinResponse(success=False, error=f"Server error: {exc}")


def verify_admin_pin(pin: str, email: str) -> VerifyPinResponse:
    """Validate the submitted PIN against the stored Firestore value."""
    if _is_pin_rate_limited(email):
        return VerifyPinResponse(success=False, error="Too many attempts. Please wait 10 minutes before trying again.")
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
        if not secrets.compare_digest(pin, stored_pin):
            _record_failed_pin(email)
            return VerifyPinResponse(success=False, error="Incorrect PIN")
        _clear_pin_attempts(email)
        doc.reference.set({"pin": None, "pinExpiresAt": None}, merge=True)
        role = data.get("role") or "admin"
        token = _generate_session_token(email, role)
        return VerifyPinResponse(success=True, token=token, role=role)
    except Exception as exc:  # noqa: BLE001
        logging.exception("verify_admin_pin failed")
        return VerifyPinResponse(success=False, error="A server error occurred. Try again.")


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
    try:
        start_at = _parse_iso_datetime(payload.startAt)
        end_at = _parse_iso_datetime(payload.endAt)
    except ValueError as exc:
        raise ValueError(f"Invalid datetime value: {exc}") from exc

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
# Categories
# ---------------------------------------------------------------------------

_DEFAULT_CATEGORIES = [
    "Programming",
    "Design & UI/UX",
    "Business & Marketing",
    "Data Science & AI",
    "Language",
    "Other",
]


def list_categories() -> list:
    from .models import CategoryItem
    cached, hit = _cache.get("categories:all")
    if hit:
        return cached
    client = _get_firestore_client()
    docs = list(client.collection("categories").order_by("name").stream())
    if not docs:
        now = datetime.now(UTC)
        batch = client.batch()
        for name in _DEFAULT_CATEGORIES:
            ref = client.collection("categories").document()
            batch.set(ref, {"name": name, "createdAt": now, "updatedAt": now})
        batch.commit()
        docs = list(client.collection("categories").order_by("name").stream())
    items = []
    for doc in docs:
        data = doc.to_dict() or {}
        items.append(CategoryItem(
            id=doc.id,
            name=str(data.get("name", "")),
            createdAt=_to_iso(data.get("createdAt")),
            updatedAt=_to_iso(data.get("updatedAt")),
        ))
    _cache.set("categories:all", items, _TTL_STATIC)
    return items


def create_category(payload) -> object:
    from .models import CategoryItem
    _cache.delete("categories:all")
    client = _get_firestore_client()
    now = datetime.now(UTC)
    doc_ref = client.collection("categories").document()
    doc_ref.set({"name": payload.name.strip(), "createdAt": now, "updatedAt": now})
    return CategoryItem(id=doc_ref.id, name=payload.name.strip(), createdAt=now.isoformat(), updatedAt=now.isoformat())


def update_category(category_id: str, payload) -> object:
    from .models import CategoryItem
    _cache.delete("categories:all")
    client = _get_firestore_client()
    now = datetime.now(UTC)
    doc_ref = client.collection("categories").document(category_id)
    doc_ref.set({"name": payload.name.strip(), "updatedAt": now}, merge=True)
    data = doc_ref.get().to_dict() or {}
    return CategoryItem(
        id=category_id,
        name=str(data.get("name", "")),
        createdAt=_to_iso(data.get("createdAt")),
        updatedAt=_to_iso(data.get("updatedAt")),
    )


def delete_category(category_id: str) -> None:
    _cache.delete("categories:all")
    client = _get_firestore_client()
    client.collection("categories").document(category_id).delete()


# ---------------------------------------------------------------------------
# Languages
# ---------------------------------------------------------------------------

def list_languages() -> list:
    from .models import LanguageItem
    cached, hit = _cache.get("languages:all")
    if hit:
        return cached
    client = _get_firestore_client()
    docs = list(client.collection("languages").order_by("name").stream())
    items = []
    for doc in docs:
        data = doc.to_dict() or {}
        items.append(LanguageItem(
            id=doc.id,
            name=str(data.get("name", "")),
            level=str(data.get("level", "Beginner")),
            createdAt=_to_iso(data.get("createdAt")),
            updatedAt=_to_iso(data.get("updatedAt")),
        ))
    _cache.set("languages:all", items, _TTL_STATIC)
    return items


def create_language(payload) -> object:
    from .models import LanguageItem
    _cache.delete("languages:all")
    client = _get_firestore_client()
    now = datetime.now(UTC)
    doc_ref = client.collection("languages").document()
    doc_ref.set({"name": payload.name.strip(), "level": payload.level, "createdAt": now, "updatedAt": now})
    return LanguageItem(id=doc_ref.id, name=payload.name.strip(), level=payload.level, createdAt=now.isoformat(), updatedAt=now.isoformat())


def update_language(language_id: str, payload) -> object:
    from .models import LanguageItem
    _cache.delete("languages:all")
    client = _get_firestore_client()
    now = datetime.now(UTC)
    doc_ref = client.collection("languages").document(language_id)
    updates: dict = {"updatedAt": now}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.level is not None:
        updates["level"] = payload.level
    doc_ref.set(updates, merge=True)
    data = doc_ref.get().to_dict() or {}
    return LanguageItem(
        id=language_id,
        name=str(data.get("name", "")),
        level=str(data.get("level", "Beginner")),
        createdAt=_to_iso(data.get("createdAt")),
        updatedAt=_to_iso(data.get("updatedAt")),
    )


def delete_language(language_id: str) -> None:
    _cache.delete("languages:all")
    client = _get_firestore_client()
    client.collection("languages").document(language_id).delete()


_GDRIVE_ID_RE = re.compile(r"drive\.google\.com/(?:file/d/|uc\?.*id=)([a-zA-Z0-9_-]+)")


def _get_gdrive_embed_url(share_url: str) -> str:
    m = _GDRIVE_ID_RE.search(share_url)
    if not m:
        raise ValueError(f"Cannot extract Google Drive file ID from: {share_url}")
    file_id = m.group(1)
    return f"https://drive.google.com/file/d/{file_id}/preview"


def list_library_items() -> list[LibraryItem]:
    cached, hit = _cache.get("library:all")
    if hit:
        return cached
    client = _get_firestore_client()
    docs = client.collection("library").order_by("title").stream()
    items: list[LibraryItem] = []
    for doc in docs:
        data = doc.to_dict() or {}
        item_type = str(data.get("type", "pdf"))
        content_preview = str(data.get("content", "")) if item_type in ("url", "gdrive") else ""
        items.append(LibraryItem(
            id=doc.id,
            courseId=str(data.get("courseId", "")),
            courseName=str(data.get("courseName", "")),
            title=str(data.get("title", "")),
            type=item_type,
            content=content_preview,
            language=str(data.get("language")) if data.get("language") else None,
            createdAt=_to_iso(data.get("createdAt")),
            updatedAt=_to_iso(data.get("updatedAt")),
        ))
    _cache.set("library:all", items, _TTL_STATIC)
    return items


def get_library_item(item_id: str) -> LibraryItem | None:
    cache_key = f"library:{item_id}"
    cached, hit = _cache.get(cache_key)
    if hit:
        return cached
    client = _get_firestore_client()
    doc = client.collection("library").document(item_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    item = LibraryItem(
        id=doc.id,
        courseId=str(data.get("courseId", "")),
        courseName=str(data.get("courseName", "")),
        title=str(data.get("title", "")),
        type=str(data.get("type", "pdf")),
        content=str(data.get("content", "")),
        language=str(data.get("language")) if data.get("language") else None,
        createdAt=_to_iso(data.get("createdAt")),
        updatedAt=_to_iso(data.get("updatedAt")),
    )
    _cache.set(cache_key, item, _TTL_STATIC)
    return item


def create_library_item(payload: LibraryItemCreate) -> LibraryItem:
    _cache.delete("library:all")
    content = payload.content
    stored_type = payload.type
    if payload.type == "gdrive":
        content = _get_gdrive_embed_url(payload.content)
        stored_type = "gdrive"
    client = _get_firestore_client()
    now = datetime.now(UTC)
    doc_ref = client.collection("library").document()
    doc_ref.set({
        "courseId": payload.courseId,
        "courseName": payload.courseName,
        "title": payload.title.strip(),
        "type": stored_type,
        "content": content,
        "language": payload.language.strip() if payload.language else None,
        "createdAt": now,
        "updatedAt": now,
    })
    item = LibraryItem(
        id=doc_ref.id,
        courseId=payload.courseId,
        courseName=payload.courseName,
        title=payload.title.strip(),
        type=stored_type,
        content=content,
        language=payload.language.strip() if payload.language else None,
        createdAt=now.isoformat(),
        updatedAt=now.isoformat(),
    )
    _cache.set(f"library:{doc_ref.id}", item, _TTL_STATIC)
    return item


def update_library_item(item_id: str, payload: LibraryItemUpdate) -> LibraryItem | None:
    _cache.delete("library:all", f"library:{item_id}")
    client = _get_firestore_client()
    doc_ref = client.collection("library").document(item_id)
    if not doc_ref.get().exists:
        return None
    now = datetime.now(UTC)
    updates: dict[str, Any] = {"updatedAt": now}
    if payload.courseId is not None:
        updates["courseId"] = payload.courseId
    if payload.courseName is not None:
        updates["courseName"] = payload.courseName
    if payload.title is not None:
        updates["title"] = payload.title.strip()
    if payload.type is not None:
        updates["type"] = payload.type
    if payload.content is not None:
        updates["content"] = payload.content
    if payload.language is not None:
        updates["language"] = payload.language.strip() if payload.language else None
    doc_ref.set(updates, merge=True)
    data = doc_ref.get().to_dict() or {}
    item = LibraryItem(
        id=item_id,
        courseId=str(data.get("courseId", "")),
        courseName=str(data.get("courseName", "")),
        title=str(data.get("title", "")),
        type=str(data.get("type", "pdf")),
        content=str(data.get("content", "")),
        language=str(data.get("language")) if data.get("language") else None,
        createdAt=_to_iso(data.get("createdAt")),
        updatedAt=_to_iso(data.get("updatedAt")),
    )
    _cache.set(f"library:{item_id}", item, _TTL_STATIC)
    return item


def delete_library_item(item_id: str) -> None:
    _cache.delete("library:all", f"library:{item_id}")
    client = _get_firestore_client()
    client.collection("library").document(item_id).delete()


# ---------------------------------------------------------------------------
# Course Notes  (one note document per course, stored in "course-notes" collection)
# ---------------------------------------------------------------------------

def get_course_note(course_id: str) -> CourseNoteItem | None:
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