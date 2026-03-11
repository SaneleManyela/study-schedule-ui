import re

from .models import (
    ResearchQueryRequest,
    ResearchResponse,
    WorkflowRunRequest,
    WorkflowRunResponse,
    WorkflowStepResult,
)


WORKFLOW_STEPS: list[tuple[int, str, str | None, str]] = [
    (1, "Upload assignment brief and rubric to NotebookLM", "https://notebooklm.google.com", "open-url"),
    (2, "Research topic in Perplexity with citations", "https://perplexity.ai", "open-url"),
    (3, "Use Claude for structured outline", "https://claude.ai", "open-url"),
    (4, "Write the essay draft", None, "manual"),
    (5, "Send clean text to bolt.new custom app", "https://bolt.new", "open-url"),
    (6, "Re-check with NotebookLM", "https://notebooklm.google.com", "open-url"),
    (7, "Run Ryne review pass", "https://ryne.ai", "open-url"),
    (8, "Validate citations with Citely", "https://citely.ai", "open-url"),
    (9, "Manually revise flagged sections", None, "manual"),
    (10, "Create version history in DripWriter", "https://dripwriter.com", "open-url"),
    (11, "Final Ryne pass", "https://ryne.ai", "open-url"),
]


def _is_valid_email(email: str) -> bool:
    pattern = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
    return re.match(pattern, email) is not None


def build_response(payload: ResearchQueryRequest) -> ResearchResponse:
    has_sources = len(payload.documents) > 0
    has_token = bool(payload.settings.replicateApiToken.strip())
    source_names = ", ".join(doc.name for doc in payload.documents[:3])

    missing: list[str] = []
    if not has_token:
        missing.append("a Replicate API token")
    if not has_sources:
        missing.append("at least one source PDF or Drive link")

    if missing:
        return ResearchResponse(
            title="Notebook execution is not ready",
            summary=(
                "FastAPI received your request successfully, but the runtime inputs are incomplete. "
                f"Please add {' and '.join(missing)} before running the notebook pipeline."
            ),
            evidence=[
                f"Question captured: {payload.question}",
                f"Configured model: {payload.settings.preferredModel}",
                f"Notebook target: {payload.settings.notebookPath}",
            ],
            nextAction=(
                "Connect this endpoint to a Python runner that executes notebook Steps 3-6 after "
                "source ingestion and model configuration are complete."
            ),
        )

    return ResearchResponse(
        title="FastAPI handoff completed",
        summary=(
            "The request reached FastAPI and the notebook prerequisites are present. "
            "The endpoint is now ready for integrating the real retrieval and inference calls."
        ),
        evidence=[
            f"Question queued: {payload.question}",
            f"Primary sources: {source_names or f'{len(payload.documents)} sources ready'}",
            f"Project: {payload.profile.projectTitle or 'Academic Truth Engine'}",
            f"Model handoff: {payload.settings.preferredModel}",
        ],
        nextAction=(
            "Replace build_response with the real notebook execution path and return grounded citations "
            "from your backend retrieval chain."
        ),
    )


def run_assignment_workflow(payload: WorkflowRunRequest) -> WorkflowRunResponse:
    normalized_email = payload.email.strip().lower()

    if not _is_valid_email(normalized_email):
        return WorkflowRunResponse(
            status="blocked",
            summary="Workflow blocked because a valid account email is required.",
            steps=[
                WorkflowStepResult(
                    id=0,
                    title="Account setup",
                    status="blocked",
                    action="validate-email",
                    message="Provide a valid email format before workflow orchestration can proceed.",
                )
            ],
        )

    steps: list[WorkflowStepResult] = []
    for step_id, title, launch_url, action in WORKFLOW_STEPS:
        if action == "open-url" and launch_url:
            steps.append(
                WorkflowStepResult(
                    id=step_id,
                    title=title,
                    status="in-progress",
                    action="open-url",
                    message=(
                        f"Use {normalized_email} to sign in or create an account, then complete this step in the linked tool."
                    ),
                    launchUrl=launch_url,
                )
            )
        else:
            steps.append(
                WorkflowStepResult(
                    id=step_id,
                    title=title,
                    status="done",
                    action="manual",
                    message="Manual drafting/revision step. Complete directly in the editor before proceeding.",
                )
            )

    return WorkflowRunResponse(
        status="ready",
        summary=(
            "Workflow plan generated successfully. External tools require browser launch + manual completion; "
            "manual writing steps are marked complete-by-default for tracking."
        ),
        steps=steps,
    )