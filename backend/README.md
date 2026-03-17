# FastAPI backend

This service is the Python bridge between the React workbench and the notebook-style research workflow.

## What this backend does

1. Receives research requests from the Ask/Main frontend pages.
2. Validates incoming payloads using Pydantic schemas.
3. Returns structured response objects the frontend can render.
4. Generates assignment workflow step plans for the Truth Engine page.

## Project layout

- backend/app/main.py: FastAPI app setup, CORS, and route handlers.
- backend/app/models.py: Pydantic request/response schema models.
- backend/app/service.py: Business logic for research and workflow endpoints.

## Local setup

1. Create a virtual environment in the repository root.
2. Activate the environment.
3. Install backend dependencies.

```powershell
pip install -r backend/requirements.txt
```

## Run the API

Recommended command:

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Alternative command (also valid when launcher scripts are healthy):

```powershell
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at http://127.0.0.1:8000.

## API endpoints

### GET /api/health

Returns a lightweight status payload:

```json
{
	"status": "ok",
	"mode": "bridge"
}
```

### POST /api/research/query

Consumes question + source documents + runtime settings + profile context and returns:

- title
- summary
- evidence array
- nextAction

Current behavior:

- If required runtime inputs are missing (for example no token or no sources), the response explains what is missing.
- If inputs are present, the response confirms handoff readiness.

Note: this endpoint is currently a bridge/stub for notebook execution readiness. Replace logic in backend/app/service.py with your real retrieval + inference pipeline when integrating production notebook execution.

### POST /api/workflow/run

Consumes an email and returns a workflow plan with step-by-step guidance:

- id
- title
- status
- action
- message
- launchUrl (optional)

Current behavior:

- Invalid email format returns a blocked workflow response.
- Valid email returns a generated plan for external tools and manual steps.

## CORS behavior

The backend currently allows these dev frontend origins:

- http://localhost:5173
- http://127.0.0.1:5173

If your frontend runs on a different origin, update the CORS allow_origins list in backend/app/main.py.

## Frontend integration notes

- The frontend calls this backend via /api/research/query and /api/workflow/run.
- The UI now includes in-flight loaders and elapsed-time indicators while requests are processing.
- If you see requests in backend logs but no visible frontend result, check browser console/network payload shape and confirm the response contains title, summary, evidence, and nextAction fields.