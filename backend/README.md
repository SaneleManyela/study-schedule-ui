# FastAPI backend

This service is the Python bridge between the React workbench and your notebook workflow.

## Run

1. Create and activate a virtual environment for the backend.
2. Install dependencies:

```powershell
pip install -r backend/requirements.txt
```

3. Start the API:

```powershell
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Endpoints

- `GET /api/health`
- `POST /api/research/query`
- `POST /api/workflow/run`

The `POST /api/research/query` endpoint currently validates and packages requests. Replace `backend/app/service.py` with your real notebook execution path for full retrieval + inference.

`POST /api/workflow/run` drives the Truth Engine assignment workflow orchestration. It validates the provided email and returns an operational plan with per-step status, action type, and launch URL (where applicable).