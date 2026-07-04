# Security Audit Report — Study Planner

**Audit date:** 2026-07-04  
**Audited by:** GitHub Copilot (Claude Sonnet 4.6)  
**Scope:** Full-stack — FastAPI backend (`backend/`), React/TypeScript frontend (`src/`), Firestore data layer, authentication flow, API surface  
**Severity scale:** Critical → High → Medium → Low → Informational

---

## Executive Summary

Six security issues were identified. Three were **Critical** and have been fully remediated in this session. One **High** issue (live credential exposure) requires immediate manual action from the repository owner. Two findings were determined to be non-issues after code review and are documented here for transparency.

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| SEC-01 | All API endpoints publicly accessible — no authentication | Critical | ✅ Fixed |
| SEC-02 | Client-side-only authentication — trivially bypassed | Critical | ✅ Fixed |
| SEC-03 | PIN endpoint has no rate limiting — brute-forceable | Critical | ✅ Fixed |
| SEC-04 | Live credentials stored in `.env` visible in conversation | High | ⚠️ Requires manual rotation |
| SEC-05 | Legacy plaintext password path in `_verify_password` | Medium | ⚠️ Acknowledged, migration path needed |
| SEC-06 | SQL injection via single quotes in input fields | — | ✅ Not applicable (Firestore SDK) |

---

## Detailed Findings

---

### SEC-01 — All API Endpoints Publicly Accessible

**Severity:** Critical  
**Status:** Fixed  
**OWASP category:** A01:2021 – Broken Access Control

#### Description

Before this fix, every FastAPI endpoint was completely unauthenticated. Any person or script with network access to the backend could:

- Read all schedules, study plans, courses, library items, and notes for all users
- Create, modify, or delete any resource
- Enumerate all stored data by calling `GET /api/courses`, `GET /api/schedules`, etc. directly

There was no `Authorization` header check, no session validation, and no middleware of any kind protecting the data layer.

#### Affected endpoints (before fix)

```
GET  /api/schedules
POST /api/schedules
GET  /api/study-plans
POST /api/study-plans
GET  /api/courses
POST /api/courses
PUT  /api/courses/{id}
DELETE /api/courses/{id}
GET  /api/library
GET  /api/library/{id}
POST /api/library
PATCH /api/library/{id}
DELETE /api/library/{id}
GET  /api/notes/{course_id}
PUT  /api/notes/{course_id}
GET  /api/proxy
```

#### Fix applied

**`backend/app/main.py`** — HTTP middleware added:

```python
_AUTH_EXEMPT = frozenset([
    "/api/health",
    "/api/auth/check-email",
    "/api/auth/verify-password",
    "/api/auth/send-pin",
    "/api/auth/verify-pin",
    "/api/auth/signup",
])

@app.middleware("http")
async def _authenticate(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in _AUTH_EXEMPT:
        return await call_next(request)
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Authentication required."})
    if validate_session_token(auth[7:]) is None:
        return JSONResponse(status_code=401, content={"detail": "Invalid or expired session. Please log in again."})
    return await call_next(request)
```

The CORS middleware is registered **before** the auth middleware so CORS headers (`Access-Control-Allow-Origin`) are always present on 401 responses. Without this order, browsers would interpret a 401 as a CORS failure and the client would see a confusing network error instead of a meaningful auth error.

---

### SEC-02 — Client-Side-Only Authentication

**Severity:** Critical  
**Status:** Fixed  
**OWASP category:** A07:2021 – Identification and Authentication Failures

#### Description

The only protection on all `/admin/*` routes was a React Router loader in `routes.ts`:

```typescript
// Before fix — trivially bypassed
function requireAdmin() {
  if (localStorage.getItem("studyPlannerAdmin") !== "true") {
    return redirect("/login");
  }
  return null;
}
```

An attacker could bypass this entirely by opening DevTools and running:

```javascript
localStorage.setItem("studyPlannerAdmin", "true");
```

This would grant full access to all admin pages and all API calls, because the backend had no auth check (SEC-01). Even with SEC-01 fixed, a malicious token from a previous session or a manually crafted value in localStorage would not be accepted by the backend because the backend now validates a cryptographic signature.

#### Fix applied

**`backend/app/service.py`** — Stateless HMAC-SHA256 session tokens:

```python
_SESSION_SECRET = secrets.token_hex(32)  # generated once per server process
_SESSION_TTL = 8 * 3600  # 8 hours

def _generate_session_token(email: str) -> str:
    b64_email = base64.urlsafe_b64encode(email.encode()).decode().rstrip("=")
    expires_ts = int(time.time()) + _SESSION_TTL
    payload = f"{b64_email}:{expires_ts}"
    sig = _hmac_mod.new(_SESSION_SECRET.encode(), payload.encode(), "sha256").hexdigest()
    return f"{payload}:{sig}"

def validate_session_token(token: str) -> str | None:
    # Validates signature with secrets.compare_digest (timing-safe)
    # Checks expiry timestamp
    # Returns email on success, None on any failure
```

Token format: `b64url(email):unix_expiry:hmac_sha256_hex`

Properties:
- Tamper-evident — any modification to the payload invalidates the HMAC
- Time-limited — 8-hour TTL embedded in and protected by the signature
- Server-restart invalidating — `_SESSION_SECRET` is regenerated on each startup; old tokens are rejected. This is intentional: the application has no persistent session store, so restart = all sessions end
- Constant-time comparison — `secrets.compare_digest` used in signature check to prevent timing attacks

**`src/app/lib/api.ts`** — Token attached to every API request:

```typescript
const token = localStorage.getItem("studyPlannerToken");
// added to every requestJson() call:
...(token ? { "Authorization": `Bearer ${token}` } : {}),
```

On 401 response, auth state is cleared and the user is redirected to login:

```typescript
if (response.status === 401) {
  clearAuthSession();  // removes studyPlannerToken, studyPlannerAdmin, studyPlannerEmail
  throw new Error("Session expired. Please log in again.");
}
```

---

### SEC-03 — PIN Endpoint Has No Rate Limiting

**Severity:** Critical  
**Status:** Fixed  
**OWASP category:** A07:2021 – Identification and Authentication Failures

#### Description

The login flow issues a 6-digit numeric PIN (100,000–999,999 range, effectively 10^6 = 1,000,000 combinations). Before this fix, `POST /api/auth/verify-pin` had no attempt counter, no lockout, and no delay. An attacker who knew a valid email address could write a loop to test all 1,000,000 combinations. At 100 requests/second, this would take approximately 2.8 hours.

The attack surface was made worse by:
- The backend returning a clear `{"success": false, "error": "Incorrect PIN"}` vs `{"success": true}` distinction
- No CAPTCHA or human verification step
- No server-side logging of repeated failures

#### Fix applied

**`backend/app/service.py`** — Sliding-window rate limiter per email address:

```python
_pin_attempts: dict[str, list[float]] = {}
_pin_lock = threading.Lock()
_PIN_MAX_ATTEMPTS = 5
_PIN_WINDOW_SECONDS = 600  # 10 minutes

def _record_failed_pin(email: str) -> bool:
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
```

`verify_admin_pin` now:
1. Checks rate limit **before** any Firestore read — returns `429`-equivalent error immediately
2. Calls `_record_failed_pin(email)` on any wrong PIN
3. Calls `_clear_pin_attempts(email)` on success — legitimate user resets their window
4. Invalidates the PIN in Firestore (`set({pin: None, pinExpiresAt: None}, merge=True)`) immediately on success — a PIN can only be used once

After 5 failed attempts, the response is:
```
"Too many attempts. Please wait 10 minutes before trying again."
```

> **Limitation acknowledged:** `_pin_attempts` is in-memory. It resets on server restart and does not work across multiple backend instances. For a production deployment with horizontal scaling, replace with a Redis atomic counter or a short-TTL Firestore document. For a single-instance deployment this is sufficient.

---

### SEC-04 — Live Credentials Exposed in Conversation

**Severity:** High  
**Status:** ⚠️ Requires manual action — cannot be fixed by code change

#### Description

The `.env` file in `backend/` is correctly gitignored and was never committed to the repository. However, the contents were shared in this chat conversation, which means the following credentials must be treated as compromised:

| Credential | Value seen in conversation | Service |
|------------|---------------------------|---------|
| `SMTP_PASSWORD` | `nwwnziwnfzbmktmq` | Gmail App Password |
| `RESEND_API_KEY` | `re_idUKWKY2_92ymR4AFixSEKyTQ4tQhZLgz` | Resend email API |

#### Required actions

1. **Gmail App Password** — Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), revoke `nwwnziwnfzbmktmq`, generate a new App Password, update `SMTP_PASSWORD` in `backend/.env`

2. **Resend API key** — Go to [resend.com/api-keys](https://resend.com/api-keys), revoke `re_idUKWKY2_92ymR4AFixSEKyTQ4tQhZLgz`, generate a new key, update `RESEND_API_KEY` in `backend/.env`

3. **Firebase service account** — `backend/service-account.json` was not shown in conversation but also lives outside version control. Confirm it is gitignored (it is). Rotate it at [console.firebase.google.com](https://console.firebase.google.com) → Project Settings → Service Accounts if there is any doubt about its exposure.

#### Prevention going forward

Never paste `.env` file contents, API keys, or passwords into any chat interface — AI assistants, support chats, Slack, GitHub issues, etc. Use a secrets manager (e.g., Google Secret Manager, AWS Secrets Manager, HashiCorp Vault) in production instead of `.env` files.

---

### SEC-05 — Legacy Plaintext Password Path in `_verify_password`

**Severity:** Medium  
**Status:** ⚠️ Acknowledged — migration path recommended

#### Description

`_verify_password` in `service.py` contains a fallback branch for accounts that were created before PBKDF2 hashing was introduced:

```python
def _verify_password(password: str, stored: str) -> bool:
    if stored.startswith("pbkdf2:"):
        _, salt, expected = stored.split(":", 2)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return secrets.compare_digest(dk.hex(), expected)
    # Legacy plaintext comparison for existing admin docs
    return secrets.compare_digest(password, stored)
```

If Firestore was ever populated with plaintext passwords (e.g., during early development), those accounts compare the submitted plaintext directly against the stored plaintext. While `secrets.compare_digest` prevents timing attacks, the underlying plaintext is still stored unprotected in Firestore.

Note: The `secrets.compare_digest` call does NOT provide security here — it only makes the comparison take constant time. The actual password text is still readable by anyone with Firestore console access or a leaked service account.

#### Recommended fix (not yet implemented)

On successful login via the legacy path, re-hash immediately:

```python
def _verify_password(password: str, stored: str) -> bool:
    if stored.startswith("pbkdf2:"):
        _, salt, expected = stored.split(":", 2)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return secrets.compare_digest(dk.hex(), expected)
    # Legacy: compare then upgrade
    if secrets.compare_digest(password, stored):
        return True  # caller must re-hash the password and write it back to Firestore
    return False
```

Update `verify_admin_password` in `service.py` to check whether the stored value lacks the `pbkdf2:` prefix and, if so, call `doc.reference.set({"password": _hash_password(password)}, merge=True)` after successful verification.

---

### SEC-06 — Single Quotes / SQL Injection via Input Fields

**Severity:** N/A  
**Status:** ✅ Not applicable

#### Description

Single quotes, double quotes, or any special characters entered into text fields (course names, schedule titles, library item content, notes, etc.) do **not** constitute an injection risk in this application.

#### Why this is safe

This application uses **Cloud Firestore** via the Python Firebase Admin SDK. Firestore is a document database with no SQL query language. All queries are built using the SDK's `FieldFilter` objects:

```python
# Example from service.py — parameterized by design
db.collection("courses").where(filter=FieldFilter("email", "==", email)).stream()
```

There are no f-strings, no string concatenation, and no template strings used to construct query predicates. Collection paths are hardcoded constants (`"courses"`, `"library"`, `"schedules"`, etc.) — none are derived from user input.

All input models are validated by Pydantic v2 with `Field(min_length=..., max_length=..., pattern=...)` constraints before any data reaches the service layer. Special characters are stored and retrieved as literal text with no interpretation.

---

## Authentication Flow Overview (post-fix)

```
1. User enters email
   └─ GET /api/auth/check-email  (no auth required)
       └─ returns { exists: bool }

2. User enters password
   └─ POST /api/auth/verify-password  (no auth required)
       └─ PBKDF2-HMAC-SHA256 comparison (260,000 iterations)
       └─ returns { success: bool }

3. Server sends 6-digit PIN to email (10-minute TTL)
   └─ POST /api/auth/send-pin  (no auth required)

4. User enters PIN
   └─ POST /api/auth/verify-pin  (no auth required)
       └─ Rate limit: 5 attempts / 10 minutes per email
       └─ Constant-time PIN comparison
       └─ PIN invalidated in Firestore on success
       └─ Returns { success: true, token: "<hmac-signed-token>" }

5. Frontend stores token in localStorage.studyPlannerToken

6. All subsequent API calls:
   └─ Authorization: Bearer <token>
   └─ Backend middleware validates HMAC + expiry
   └─ 401 on any failure → frontend clears session → redirect to /login

7. Token TTL: 8 hours from issue
   └─ Also invalidated on server restart (in-memory secret key)
```

---

## Remaining Recommendations

These items are outside the scope of what was implemented but are recommended for a production deployment:

| # | Recommendation | Priority |
|---|---------------|----------|
| R1 | Migrate legacy plaintext passwords to PBKDF2 on next successful login (SEC-05) | High |
| R2 | Move `_SESSION_SECRET` to a persistent environment variable so tokens survive server restarts | Medium |
| R3 | Replace in-memory PIN rate limiter with Redis or Firestore counter for multi-instance deployments | Medium |
| R4 | Add `Secure` and `HttpOnly` flag considerations — if moving tokens from localStorage to httpOnly cookies, XSS cannot steal them | Medium |
| R5 | Enforce HTTPS in production — passwords transit as JSON; without TLS they are plaintext on the wire | High |
| R6 | Add per-IP rate limiting on the `/api/auth/verify-password` endpoint to slow password enumeration | Medium |
| R7 | Rotate all credentials listed in SEC-04 immediately | Critical |
| R8 | Audit Firestore security rules — if the service account is compromised, rules are the last line of defense | High |

---

## Files Modified in This Audit

| File | Change |
|------|--------|
| `backend/app/models.py` | Added `token: str \| None = None` to `VerifyPinResponse` |
| `backend/app/service.py` | Added `hmac` import, session token generation/validation, PIN rate limiter, updated `verify_admin_pin` |
| `backend/app/main.py` | Added `Request`/`JSONResponse` imports, `validate_session_token` import, auth middleware |
| `src/app/lib/api.ts` | Added `setAuthToken`, `clearAuthSession`, token attachment in `requestJson`, 401 handler |
| `src/app/pages/LoginPage.tsx` | Stores token on successful PIN verification |
| `src/app/pages/AdminLayout.tsx` | Uses `clearAuthSession()` on logout |
