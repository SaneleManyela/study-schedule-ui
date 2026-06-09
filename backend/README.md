# FastAPI backend

This backend serves the calendar and study planner frontend using Firestore for persistence.

## What this backend does

1. Exposes health, schedule, and study-plan endpoints.
2. Validates payloads with Pydantic.
3. Reads and writes planner data in Firestore.

## Project layout

- `backend/app/main.py`: FastAPI app setup and route handlers.
- `backend/app/models.py`: Request/response schema models.
- `backend/app/service.py`: Firestore access logic.

## Local setup

```powershell
pip install -r backend/requirements.txt
```

## Firebase configuration

Use one of these approaches:

1. Set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON file path.
2. Set `FIREBASE_SERVICE_ACCOUNT_JSON` with raw service-account JSON.

Optional:

- Set `FIREBASE_PROJECT_ID` to pin a project.

## Run the API

```powershell
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

## API endpoints

### GET /api/health

Returns:

```json
{
  "status": "ok",
  "mode": "study-planner"
}
```

### GET /api/schedules

Returns all schedule entries ordered by start time.

### POST /api/schedules

Creates a schedule entry.

Request body:

```json
{
  "title": "Biology deep work",
  "description": "Review chapter 4 notes",
  "startAt": "2026-06-10T09:00:00",
  "endAt": "2026-06-10T10:30:00"
}
```

### GET /api/study-plans

Returns all study plans ordered by session date.

### POST /api/study-plans

Creates a study plan entry.

Request body:

```json
{
  "title": "Exam prep day 1",
  "goal": "Finish chapters 1-2",
  "sessionDate": "2026-06-10",
  "durationMinutes": 90,
  "notes": "Start with hardest topic"
}
```
