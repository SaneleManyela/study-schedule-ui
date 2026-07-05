"""FastAPI application entrypoint for the calendar and study planner backend."""

import ipaddress
import logging
import re
import urllib.parse

import requests as _requests
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

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
    CategoryCreate,
    CategoryItem,
    CategoryUpdate,
    LanguageCreate,
    LanguageItem,
    LanguageUpdate,
    LibraryItemCreate,
    LibraryItemUpdate,
    LibraryItem,
    CourseNoteUpsert,
    CourseNoteItem,
)
from .service import (
    create_schedule, create_study_plan, list_schedules, list_study_plans,
    verify_admin_password, send_admin_pin, verify_admin_pin,
    check_admin_email, signup_admin,
    list_courses, create_course, update_course, delete_course,
    list_categories, create_category, update_category, delete_category,
    list_languages, create_language, update_language, delete_language,
    list_library_items, get_library_item, create_library_item, update_library_item, delete_library_item,
    get_course_note, upsert_course_note,
    validate_session_token,
    _record_failed_password_attempt, _is_password_rate_limited,
    _record_failed_sendpin_attempt, _is_sendpin_rate_limited,
)


# Create the FastAPI app object and expose API metadata visible in docs.
app = FastAPI(
    title="Study Planner API",
    version="0.1.0",
    description="FastAPI service for calendar schedules and study plans backed by Firestore.",
)

# ─── Request body size guard (Layer 8) ────────────────────────────────────────
# Reject bodies larger than 12 MB to prevent memory exhaustion.
# PDF uploads are the largest payload; typical PDFs are well under this.
_MAX_BODY_BYTES = 12 * 1024 * 1024  # 12 MB


@app.middleware("http")
async def _limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > _MAX_BODY_BYTES:
        return JSONResponse(
            status_code=413,
            content={"detail": f"Request body exceeds the {_MAX_BODY_BYTES // (1024*1024)} MB limit."},
        )
    return await call_next(request)

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
        "https://SaneleManyela.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths that do not require a session token.
_AUTH_EXEMPT = frozenset([
    "/api/health",
    "/api/auth/check-email",
    "/api/auth/verify-password",
    "/api/auth/send-pin",
    "/api/auth/verify-pin",
    "/api/auth/signup",
    "/api/proxy",
])


@app.middleware("http")
async def _authenticate(request: Request, call_next):
    """Reject requests to protected endpoints that lack a valid session token."""
    if request.method == "OPTIONS" or request.url.path in _AUTH_EXEMPT:
        return await call_next(request)
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Authentication required."})
    if validate_session_token(auth[7:]) is None:
        return JSONResponse(status_code=401, content={"detail": "Invalid or expired session. Please log in again."})
    return await call_next(request)


# ─── Role-based dependency helpers (Layer 4) ─────────────────────────────────

def _get_session(request: Request) -> dict:
    """Extract and validate the session token; return {email, role}."""
    auth = request.headers.get("authorization", "")
    session = validate_session_token(auth[7:]) if auth.startswith("Bearer ") else None
    if session is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return session


def require_admin(session: dict = Depends(_get_session)) -> dict:
    """Dependency: caller must have role=='admin'."""
    if session.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return session


def require_user(session: dict = Depends(_get_session)) -> dict:
    """Dependency: caller must be any authenticated role."""
    return session


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Lightweight liveness endpoint used by frontend and tooling checks.

    Returns:
        HealthResponse: Static "ok" payload that confirms the API process is up.
    """

    # Keep this endpoint deterministic and side-effect free.
    return HealthResponse(status="ok", mode="study-planner")


@app.get("/api/schedules", response_model=list[ScheduleItem])
def get_schedules(_s: dict = Depends(require_user)) -> list[ScheduleItem]:
    return list_schedules()


@app.post("/api/schedules", response_model=ScheduleItem)
def post_schedule(payload: ScheduleCreate, _s: dict = Depends(require_admin)) -> ScheduleItem:
    try:
        return create_schedule(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/study-plans", response_model=list[StudyPlanItem])
def get_study_plans(_s: dict = Depends(require_user)) -> list[StudyPlanItem]:
    return list_study_plans()


@app.post("/api/study-plans", response_model=StudyPlanItem)
def post_study_plan(payload: StudyPlanCreate, _s: dict = Depends(require_admin)) -> StudyPlanItem:
    return create_study_plan(payload)


@app.post("/api/auth/verify-password", response_model=VerifyPasswordResponse)
def auth_verify_password(payload: VerifyPasswordRequest) -> VerifyPasswordResponse:
    """Verify admin password against the passwords Firestore collection."""
    if _is_password_rate_limited(payload.email):
        return VerifyPasswordResponse(success=False, error="Too many attempts. Please wait 10 minutes.")
    result = verify_admin_password(payload.password, payload.email)
    if not result.success:
        _record_failed_password_attempt(payload.email)
    return result


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
    if _is_sendpin_rate_limited(payload.email):
        return SendPinResponse(success=False, error="Too many PIN requests. Please wait 10 minutes.")
    result = send_admin_pin(payload.email)
    if result.success:
        _record_failed_sendpin_attempt(payload.email)  # counts sends, not failures
    return result


@app.post("/api/auth/verify-pin", response_model=VerifyPinResponse)
def auth_verify_pin(payload: VerifyPinRequest) -> VerifyPinResponse:
    """Verify the submitted PIN."""

    return verify_admin_pin(payload.pin, payload.email)


# ─── Courses ────────────────────────────────────────────────────────────────

@app.get("/api/courses", response_model=list[CourseItem])
def get_courses(_s: dict = Depends(require_user)) -> list[CourseItem]:
    return list_courses()


@app.post("/api/courses", response_model=CourseItem)
def post_course(payload: CourseCreate, _s: dict = Depends(require_admin)) -> CourseItem:
    return create_course(payload)


@app.put("/api/courses/{course_id}", response_model=CourseItem)
def put_course(course_id: str, payload: CourseUpdate, _s: dict = Depends(require_admin)) -> CourseItem:
    return update_course(course_id, payload)


@app.delete("/api/courses/{course_id}", status_code=204)
def remove_course(course_id: str, _s: dict = Depends(require_admin)) -> None:
    delete_course(course_id)


# ─── Categories ───────────────────────────────────────────────────────────────

@app.get("/api/categories", response_model=list[CategoryItem])
def get_categories(_s: dict = Depends(require_user)) -> list[CategoryItem]:
    return list_categories()


@app.post("/api/categories", response_model=CategoryItem)
def post_category(payload: CategoryCreate, _s: dict = Depends(require_admin)) -> CategoryItem:
    return create_category(payload)


@app.put("/api/categories/{category_id}", response_model=CategoryItem)
def put_category(category_id: str, payload: CategoryUpdate, _s: dict = Depends(require_admin)) -> CategoryItem:
    return update_category(category_id, payload)


@app.delete("/api/categories/{category_id}", status_code=204)
def remove_category(category_id: str, _s: dict = Depends(require_admin)) -> None:
    delete_category(category_id)


# ─── Languages ────────────────────────────────────────────────────────────────

@app.get("/api/languages", response_model=list[LanguageItem])
def get_languages(_s: dict = Depends(require_user)) -> list[LanguageItem]:
    return list_languages()


@app.post("/api/languages", response_model=LanguageItem)
def post_language(payload: LanguageCreate, _s: dict = Depends(require_admin)) -> LanguageItem:
    return create_language(payload)


@app.put("/api/languages/{language_id}", response_model=LanguageItem)
def put_language(language_id: str, payload: LanguageUpdate, _s: dict = Depends(require_admin)) -> LanguageItem:
    return update_language(language_id, payload)


@app.delete("/api/languages/{language_id}", status_code=204)
def remove_language(language_id: str, _s: dict = Depends(require_admin)) -> None:
    delete_language(language_id)


# ─── Library ─────────────────────────────────────────────────────────────────

@app.get("/api/library", response_model=list[LibraryItem])
def get_library(_s: dict = Depends(require_user)) -> list[LibraryItem]:
    return list_library_items()


@app.get("/api/library/{item_id}", response_model=LibraryItem)
def get_library_item_by_id(item_id: str, _s: dict = Depends(require_user)) -> LibraryItem:
    item = get_library_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Library item not found.")
    return item


@app.put("/api/library/{item_id}", response_model=LibraryItem)
def put_library_item(item_id: str, payload: LibraryItemUpdate, _s: dict = Depends(require_admin)) -> LibraryItem:
    item = update_library_item(item_id, payload)
    if item is None:
        raise HTTPException(status_code=404, detail="Library item not found.")
    return item


@app.post("/api/library", response_model=LibraryItem)
def post_library_item(payload: LibraryItemCreate, _s: dict = Depends(require_admin)) -> LibraryItem:
    logger = logging.getLogger(__name__)
    try:
        return create_library_item(payload)
    except ValueError as exc:
        logger.warning("Library item rejected (bad input): %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Google Drive download failed for %r: %s", payload.content, exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Failed to download document: {exc}") from exc


@app.delete("/api/library/{item_id}", status_code=204)
def remove_library_item(item_id: str, _s: dict = Depends(require_admin)) -> None:
    delete_library_item(item_id)


@app.patch("/api/library/{item_id}", response_model=LibraryItem)
def patch_library_item(item_id: str, payload: LibraryItemUpdate, _s: dict = Depends(require_admin)) -> LibraryItem:
    return update_library_item(item_id, payload)


# ─── URL Proxy ────────────────────────────────────────────────────────────────

_PRIVATE_NETS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]

_STRIP_HEADERS = {"x-frame-options", "transfer-encoding", "content-encoding", "content-length"}


def _is_private_host(hostname: str) -> bool:
    """Return True if hostname resolves to a private/loopback address."""
    if hostname.lower() in ("localhost",) or hostname.endswith(".local"):
        return True
    try:
        addr = ipaddress.ip_address(hostname)
        return any(addr in net for net in _PRIVATE_NETS)
    except ValueError:
        return False


@app.get("/api/proxy")
def proxy_url(
    url: str = Query(..., description="The URL to proxy"),
    info: bool = Query(False, description="When true, return embed-check JSON instead of full content"),
) -> Response:
    """Fetch an external URL server-side and return it stripped of frame-blocking headers.

    When ?info=1 is passed, performs a lightweight HEAD/GET to check whether
    the upstream page sets X-Frame-Options or CSP frame-ancestors, and returns
    a small JSON payload:  { "embeddable": bool, "reason": str | null }
    The frontend uses this to decide whether to show the proxy iframe or a
    styled fallback panel — without ever loading a blank iframe.

    Security:
    - Only http/https schemes are permitted.
    - Private, loopback, and link-local addresses are blocked (SSRF protection).
    """
    logger = logging.getLogger(__name__)

    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http/https URLs are supported.")

    hostname = parsed.hostname or ""
    if not hostname or _is_private_host(hostname):
        raise HTTPException(status_code=400, detail="URL resolves to a disallowed address.")

    if info:
        # Lightweight embeddability check — HEAD first, fall back to GET.
        try:
            head = _requests.head(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"}, allow_redirects=True)
            check_resp = head
        except Exception:
            try:
                check_resp = _requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"}, allow_redirects=True, stream=True)
            except Exception as exc:
                import json as _json
                return Response(
                    content=_json.dumps({"embeddable": False, "reason": f"unreachable: {exc}"}),
                    media_type="application/json",
                )
        xfo = check_resp.headers.get("x-frame-options", "")
        csp = check_resp.headers.get("content-security-policy", "")
        has_block = bool(xfo) or ("frame-ancestors" in csp.lower())
        import json as _json
        reason = None
        if xfo:
            reason = f"X-Frame-Options: {xfo}"
        elif "frame-ancestors" in csp.lower():
            fa = next((p.strip() for p in csp.split(";") if "frame-ancestors" in p.lower()), csp)
            reason = f"CSP {fa}"
        return Response(
            content=_json.dumps({"embeddable": not has_block, "reason": reason}),
            media_type="application/json",
        )

    try:
        resp = _requests.get(
            url,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0"},
            allow_redirects=True,
        )
    except Exception as exc:
        logger.error("Proxy fetch failed for %r: %s", url, exc)
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {exc}") from exc

    content_type = resp.headers.get("Content-Type", "text/html")
    body = resp.content

    # For HTML, inject a <base> tag so relative asset URLs resolve correctly
    # against the origin site, not our proxy origin.
    if "text/html" in content_type:
        html = resp.text
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        base_tag = f'<base href="{base_url}/">'
        if "<base" not in html:
            if "<head>" in html:
                html = html.replace("<head>", f"<head>{base_tag}", 1)
            elif "<HEAD>" in html:
                html = html.replace("<HEAD>", f"<HEAD>{base_tag}", 1)
            else:
                html = base_tag + html
        body = html.encode("utf-8", errors="replace")

    # Build clean response headers, stripping frame-blocking directives.
    clean_headers: dict[str, str] = {}
    for key, value in resp.headers.items():
        key_lower = key.lower()
        if key_lower in _STRIP_HEADERS:
            continue
        if key_lower == "content-security-policy":
            # Remove only the frame-ancestors directive; keep the rest.
            value = re.sub(r"frame-ancestors[^;]*;?\s*", "", value, flags=re.IGNORECASE).strip().rstrip(";")
            if not value:
                continue
        clean_headers[key] = value

    mime = content_type.split(";")[0].strip()
    return Response(content=body, media_type=mime, headers=clean_headers)


# ─── Course Notes ─────────────────────────────────────────────────────────────

@app.get("/api/notes/{course_id}", response_model=CourseNoteItem | None)
def get_note(course_id: str, _s: dict = Depends(require_user)) -> CourseNoteItem | None:
    return get_course_note(course_id)


@app.put("/api/notes/{course_id}", response_model=CourseNoteItem)
def put_note(course_id: str, payload: CourseNoteUpsert, _s: dict = Depends(require_user)) -> CourseNoteItem:
    return upsert_course_note(course_id, payload)