# Study Planner UI

This repository now contains a focused calendar and study schedule application.

## What this repo includes

- `src/`: React UI for calendar, schedules, and study plans.
- `backend/`: FastAPI service with Firestore-backed planner endpoints.
- `guidelines/`: Project reference material.

## App route

- `/`: Calendar and study planner interface.

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
python -m venv .venv
& .\.venv\Scripts\Activate.ps1
```

Install backend dependencies:

```powershell
pip install -r backend/requirements.txt
```

Configure Firebase authentication (one option):

1. Set `GOOGLE_APPLICATION_CREDENTIALS` to your service-account JSON path.
2. Or set `FIREBASE_SERVICE_ACCOUNT_JSON` with raw JSON.

Optional:

- Set `FIREBASE_PROJECT_ID` if you want to force the project ID.
- Set `VITE_API_BASE_URL` for frontend API routing.

Start backend API:

```powershell
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

In a second terminal, start the frontend:

```powershell
npm run dev
```

## Backend API

Base URL default: `http://127.0.0.1:8000`

- `GET /api/health`
- `GET /api/schedules`
- `POST /api/schedules`
- `GET /api/study-plans`
- `POST /api/study-plans`
