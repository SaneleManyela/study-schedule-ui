"""FastAPI application entrypoint for the Academic Truth Engine backend.

This module wires three main concerns:
1) App construction and metadata.
2) CORS policy so the Vite frontend can call this API in development.
3) HTTP route handlers that delegate core logic to the service layer.

The route handlers intentionally stay thin. Business logic is implemented in
`service.py`, while request/response schemas are declared in `models.py`.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    HealthResponse,
    ResearchQueryRequest,
    ResearchResponse,
    WorkflowRunRequest,
    WorkflowRunResponse,
)
from .service import build_response, run_assignment_workflow


# Create the FastAPI app object and expose API metadata visible in docs.
app = FastAPI(
    title="Academic Truth Engine API",
    version="0.1.0",
    description="FastAPI bridge between the React workbench and Python notebook workflow.",
)

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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Lightweight liveness endpoint used by frontend and tooling checks.

    Returns:
        HealthResponse: Static "ok" payload that confirms the API process is up.
    """

    # Keep this endpoint deterministic and side-effect free.
    return HealthResponse(status="ok", mode="bridge")


@app.post("/api/research/query", response_model=ResearchResponse)
def research_query(payload: ResearchQueryRequest) -> ResearchResponse:
    """Handle Ask-page research queries.

    The endpoint validates input via Pydantic, then delegates response building
    to the service layer. This keeps HTTP concerns and domain rules separated.

    Args:
        payload: Question + sources + settings + profile context.

    Returns:
        ResearchResponse: Structured response packet rendered by the frontend.
    """

    # Delegate to service logic so this module remains an API shell.
    return build_response(payload)


@app.post("/api/workflow/run", response_model=WorkflowRunResponse)
def workflow_run(payload: WorkflowRunRequest) -> WorkflowRunResponse:
    """Generate workflow step guidance for assignment execution.

    Args:
        payload: Email used for account/tool workflow instructions.

    Returns:
        WorkflowRunResponse: Ordered steps with statuses and launch URLs.
    """

    # Delegate to service logic for step orchestration and validation.
    return run_assignment_workflow(payload)