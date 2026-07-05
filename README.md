# Study Planner

A full-stack study management application. Admins upload courses and courseware; users access the dashboard, course overview, library, and their own notes.

## Full-stack architecture

This application is built across 13 production layers:

### Layer 1 - Frontend foundations
React 18, TypeScript, Vite 6, Tailwind CSS 4, React Router 7, Radix UI, MUI, Tiptap rich-text editor, Recharts, React Hook Form, Sonner toasts. All routing, state, and form patterns are in `src/`.

### Layer 2 - API and backend logic
FastAPI 0.116.1 with a full REST surface. Business logic is separated into `backend/app/service.py`; route handlers live in `backend/app/main.py`. Pydantic v2 validates all inputs at the API boundary before they reach any service function.

**Endpoints:** `GET|POST /api/schedules`, `GET|POST /api/study-plans`, `GET|POST|PUT|DELETE /api/courses`, `GET|POST|PUT|PATCH|DELETE /api/library`, `GET|PUT /api/notes/{course_id}`, `GET /api/proxy`, `POST /api/auth/*`

### Layer 3 - Database and storage
Cloud Firestore (NoSQL) via Firebase Admin SDK. `backend/app/models.py` defines all data shapes with Pydantic. `service.py` is the service/repository layer - all Firestore reads and writes go through it exclusively. Collections: `Auth`, `schedules`, `study_plans`, `courses`, `library`, `notes/{course_id}`.

### Layer 4 - Authentication and security configuration
- **Multi-factor login:** email - PBKDF2-HMAC-SHA256 password (260,000 iterations, salted) - 6-digit email PIN (10-minute TTL)
- **Session tokens:** HMAC-SHA256 signed, 8-hour TTL, role embedded in the payload. Token validates on every protected request via FastAPI HTTP middleware
- **Role-based access control:**

| Role | Permissions |
|------|-------------|
| `admin` | Full CRUD on courses, library, schedules, study-plans |
| `user` | Read courses + library + schedules + study-plans; full access to notes |

- **Endpoint guards:** `require_admin` / `require_user` FastAPI dependencies on every endpoint
- **CORS:** restricted to known frontend origins only

### Layer 5 - Hosting and deployment
- **Frontend:** GitHub Pages via `npm run deploy` (`gh-pages` branch, base path `/study-schedule-ui/`)
- **Backend:** Docker container (`backend/Dockerfile`, multi-stage Python 3.12 slim), deployed to Render.com
- All credentials stored in Render environment variables - never baked into the image

See `DEPLOYMENT.md` for full step-by-step instructions.

### Layer 6 - Cloud and computing
- **Render.com:** serverless, scales to zero on idle (after 15 min), scales out under load
- **Firestore:** fully managed, no servers to operate

### Layer 7 - CI/CD and version control
`.github/workflows/deploy.yml` runs on every push to `main`:
1. Triggers a new deploy on Render via API
2. Builds frontend with `VITE_API_BASE_URL` and deploys to GitHub Pages

### Layer 8 - Security
- **Request body size limit:** 12 MB cap via HTTP middleware - prevents memory exhaustion
- **SSRF protection** on `/api/proxy`: private/loopback IP ranges blocked
- **Input validation:** Pydantic `Field(min_length, max_length, pattern)` on all models
- **No injection risk:** Firestore SDK uses `FieldFilter` objects - no query strings, no SQL
- **Secrets:** never in source code or container image; loaded from Render environment variables at runtime
- **Frame-busting prevention:** proxy iframe uses `sandbox` without `allow-same-origin` so embedded page scripts cannot access or navigate the parent frame

### Layer 9 - Rate limiting
All auth endpoints are rate-limited per email address with a 10-minute sliding window:

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/verify-password` | 5 failures / 10 min |
| `POST /api/auth/verify-pin` | 5 failures / 10 min |
| `POST /api/auth/send-pin` | 3 sends / 10 min |

### Layer 10 - Caching
In-memory TTL cache in `service.py` covers all Firestore reads with write-through invalidation on every mutation:

| Collection | TTL |
|------------|-----|
| schedules, study-plans, notes | 30 seconds |
| courses, library | 60 seconds |

GitHub Pages static assets are served through Fastly CDN globally.

### Layer 11 - Load balancing and scaling
Render.com provides automatic horizontal scaling based on request load. Scale-to-zero when idle means zero cost and ~50-second cold start.

### Layer 12 - Error tracking and logs
- FastAPI logs all errors via Python `logging`
- `src/app/components/ErrorBoundary.tsx` wraps the entire React app - any unhandled render error shows a recovery UI instead of a blank white screen, and logs to the console
- All HTTP errors return structured JSON `{"detail": "..."}` with appropriate status codes

### Layer 13 - Availability and recovery
- `/api/health` endpoint used for health checks; unhealthy instances are replaced automatically
- Render.com restarts failed containers automatically
- Firestore is a Google-managed service with built-in regional redundancy
- **Recommended (not yet configured):** Firestore scheduled exports via Cloud Scheduler for point-in-time recovery

---

## What this repo includes

- `src/`: React frontend
- `backend/`: FastAPI service with Firestore-backed endpoints
- `backend/Dockerfile`: production container image
- `backend/.dockerignore`: keeps secrets and caches out of the image
- `backend/render.yaml`: Render.com blueprint configuration
- `.github/workflows/deploy.yml`: CI/CD pipeline
- `guidelines/`: project reference material
- `DEPLOYMENT.md`: full deployment instructions (Render.com)
- `SECURITY_REPORT.md`: full security audit with findings and mitigations

## App routes

- `/login` - email + password + PIN login (admin and user accounts)
- `/admin` - dashboard (all roles)
- `/admin/courses` - course overview (all roles)
- `/admin/courses/:id` - course detail (all roles)
- `/admin/courses/:id/notes` - course notes (user role)
- `/admin/calendar` - study calendar (all roles)
- `/admin/study-plan` - study plan (all roles)
- `/admin/library` - course material library (all roles; upload/edit restricted to admin)

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- Python 3.11+
- Firebase project with Firestore enabled

## Quick start

Install frontend dependencies:

```powershell
npm install
```

Create and activate a Python virtual environment:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install backend dependencies:

```powershell
pip install -r requirements.txt
```

Configure the backend - create `backend/.env`:

```env
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
FIREBASE_PROJECT_ID=study-schedule-95688
SMTP_USER=smanyela44@gmail.com
SMTP_PASSWORD=your-gmail-app-password
# Optional: RESEND_API_KEY=re_...
# Optional: SESSION_SECRET=<64-char hex string>  (stable across restarts)
```

Start backend API (from repo root):

```powershell
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

In a second terminal, start the frontend:

```powershell
npm run dev
```

Open `http://localhost:5173`.

## User roles

A new signup via the login page creates an `admin` account. To create a `user` account, sign up normally then update the `role` field in the Firestore `Auth` document to `"user"`. A dedicated user signup flow is planned for a future release.

## Backend API

Base URL in development: `http://127.0.0.1:8000` (proxied through Vite as `/api/*`)

| Method | Path | Role required |
|--------|------|---------------|
| GET | `/api/health` | None |
| GET | `/api/schedules` | Any |
| POST | `/api/schedules` | Admin |
| GET | `/api/study-plans` | Any |
| POST | `/api/study-plans` | Admin |
| GET | `/api/courses` | Any |
| POST | `/api/courses` | Admin |
| PUT/DELETE | `/api/courses/{id}` | Admin |
| GET | `/api/library` | Any |
| GET | `/api/library/{id}` | Any |
| POST/PUT/PATCH/DELETE | `/api/library/{id}` | Admin |
| GET/PUT | `/api/notes/{course_id}` | Any |
| GET | `/api/proxy` | None (public proxy) |
| POST | `/api/auth/*` | None (auth endpoints) |


