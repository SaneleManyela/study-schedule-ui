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


app = FastAPI(
    title="Academic Truth Engine API",
    version="0.1.0",
    description="FastAPI bridge between the React workbench and Python notebook workflow.",
)

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
    return HealthResponse(status="ok", mode="bridge")


@app.post("/api/research/query", response_model=ResearchResponse)
def research_query(payload: ResearchQueryRequest) -> ResearchResponse:
    return build_response(payload)


@app.post("/api/workflow/run", response_model=WorkflowRunResponse)
def workflow_run(payload: WorkflowRunRequest) -> WorkflowRunResponse:
    return run_assignment_workflow(payload)