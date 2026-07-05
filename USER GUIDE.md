# Study Planner User Guide

## 1. Overview

The app is now focused on two things:

1. Calendar-based study scheduling
2. Study plan tracking

All schedule and plan data is persisted in Firestore through the FastAPI backend.

## 2. Run the application

From project root:

```powershell
npm install
python -m venv .venv
& .\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

Set Firebase credentials using one option:

1. `GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account.json>`
2. `FIREBASE_SERVICE_ACCOUNT_JSON=<raw-json>`

Start backend:

```powershell
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Start frontend in another terminal:

```powershell
npm run dev
```

## 3. Core workflow

1. Open `/`.
2. Select a day on the calendar.
3. Create schedule entries with start/end times.
4. Create study plans with goals and duration.
5. Review entries shown for the selected day.

## 4. API reference

- `GET /api/health`
- `GET /api/schedules`
- `POST /api/schedules`
- `GET /api/study-plans`
- `POST /api/study-plans`

## 5. Deployment

### Production Deployment

The application is deployed using:

- **Frontend:** GitHub Pages (https://SaneleManyela.github.io/study-schedule-ui)
- **Backend:** Render.com (https://study-planner-api.onrender.com)

To deploy:

1. Set up the backend on Render.com using the `backend/render.yaml` blueprint
2. Add your Firebase service account JSON and other secrets in Render dashboard
3. Get the Render service URL and set it as `VITE_API_BASE_URL`
4. Run `npm run deploy` to deploy the frontend

See `DEPLOYMENT.md` for full deployment instructions.

## 6. Troubleshooting

- If backend fails on Firestore calls, verify Firebase credentials are available in environment variables.
- If frontend cannot call backend, verify `VITE_API_BASE_URL` or default backend URL `http://127.0.0.1:8000`.
- If data is missing, ensure Firestore database exists and service account has read/write permission.
- If you see CORS errors, ensure the backend allows requests from your frontend origin.