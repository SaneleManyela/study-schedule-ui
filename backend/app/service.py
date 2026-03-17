"""Service-layer business logic for backend endpoints.

This module intentionally contains no FastAPI route decorators. Instead, it
implements pure functions that receive validated Pydantic models and return
Pydantic response objects.

Current role in the project:
1) Provide a readiness-style response for research queries.
2) Produce a workflow plan for assignment orchestration.

Future role in production:
- Replace readiness/stub logic with real notebook execution, retrieval, and
    model inference, while preserving stable response schemas.
"""

import re

from .models import (
    ResearchQueryRequest,
    ResearchResponse,
    WorkflowRunRequest,
    WorkflowRunResponse,
    WorkflowStepResult,
)


# Canonical workflow sequence for the Truth Engine orchestration UI.
#
# Tuple shape:
#   (step_id, title, launch_url, action)
#
# action values:
# - "open-url": Frontend should present/launch external tool link.
# - "manual": User performs work directly in editor/workbench.
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
    """Return whether an email address appears valid using a basic regex.

    Notes:
    - This is a pragmatic format check, not a full RFC-compliant parser.
    - Good enough for workflow gating in this prototype backend.
    """

    # Keep the pattern strict enough for common address formats.
    pattern = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
    # re.match returns a match object or None; convert to bool.
    return re.match(pattern, email) is not None


def build_response(payload: ResearchQueryRequest) -> ResearchResponse:
    """Build a structured research response from frontend payload inputs.

    This function currently acts as a readiness bridge rather than running full
    retrieval/inference. It confirms whether the minimum prerequisites exist and
    returns user-facing guidance.

    Args:
        payload: Validated research query request.

    Returns:
        ResearchResponse: Ready-state or not-ready guidance payload.
    """

    # Determine whether required runtime inputs are present.
    has_sources = len(payload.documents) > 0
    has_token = bool(payload.settings.replicateApiToken.strip())

    # Keep evidence text compact by listing up to the first three source names.
    source_names = ", ".join(doc.name for doc in payload.documents[:3])

    # Build a human-readable list of missing prerequisites.
    missing: list[str] = []
    if not has_token:
        missing.append("a Replicate API token")
    if not has_sources:
        missing.append("at least one source PDF or Drive link")

    # If any prerequisites are missing, return an explanatory readiness response.
    if missing:
        return ResearchResponse(
            title="Notebook execution is not ready",
            summary=(
                "FastAPI received your request successfully, but the runtime inputs are incomplete. "
                f"Please add {' and '.join(missing)} before running the notebook pipeline."
            ),
            evidence=[
                # Echo back key context so users can self-diagnose quickly.
                f"Question captured: {payload.question}",
                f"Configured model: {payload.settings.preferredModel}",
                f"Notebook target: {payload.settings.notebookPath}",
            ],
            nextAction=(
                # Explicitly guide where to connect real execution logic.
                "Connect this endpoint to a Python runner that executes notebook Steps 3-6 after "
                "source ingestion and model configuration are complete."
            ),
        )

    # If prerequisites are present, return a success-style handoff summary.
    return ResearchResponse(
        title="FastAPI handoff completed",
        summary=(
            "The request reached FastAPI and the notebook prerequisites are present. "
            "The endpoint is now ready for integrating the real retrieval and inference calls."
        ),
        evidence=[
            # Include question and selected runtime context for visibility.
            f"Question queued: {payload.question}",
            f"Primary sources: {source_names or f'{len(payload.documents)} sources ready'}",
            f"Project: {payload.profile.projectTitle or 'Academic Truth Engine'}",
            f"Model handoff: {payload.settings.preferredModel}",
        ],
        nextAction=(
            # This is the key implementation handoff note for developers.
            "Replace build_response with the real notebook execution path and return grounded citations "
            "from your backend retrieval chain."
        ),
    )


def run_assignment_workflow(payload: WorkflowRunRequest) -> WorkflowRunResponse:
    """Generate workflow step-by-step plan for assignment execution.

    The plan is dynamic only by email validity today. If the email passes,
    each workflow step is emitted with action metadata and optional launch URL.

    Args:
        payload: Validated workflow run request containing user email.

    Returns:
        WorkflowRunResponse: Blocked response or ready workflow plan.
    """

    # Normalize once so all subsequent messages use consistent formatting.
    normalized_email = payload.email.strip().lower()

    # Hard stop early when email format is not valid enough for workflow use.
    if not _is_valid_email(normalized_email):
        return WorkflowRunResponse(
            status="blocked",
            summary="Workflow blocked because a valid account email is required.",
            steps=[
                WorkflowStepResult(
                    # Step 0 denotes pre-workflow validation gate.
                    id=0,
                    title="Account setup",
                    status="blocked",
                    action="validate-email",
                    message="Provide a valid email format before workflow orchestration can proceed.",
                )
            ],
        )

    # Build ordered steps from static workflow definitions.
    steps: list[WorkflowStepResult] = []
    for step_id, title, launch_url, action in WORKFLOW_STEPS:
        # URL-based steps are surfaced as actionable in-progress tasks.
        if action == "open-url" and launch_url:
            steps.append(
                WorkflowStepResult(
                    id=step_id,
                    title=title,
                    status="in-progress",
                    action="open-url",
                    message=(
                        # Include normalized email directly in user guidance.
                        f"Use {normalized_email} to sign in or create an account, then complete this step in the linked tool."
                    ),
                    launchUrl=launch_url,
                )
            )
        else:
            # Manual tasks are represented as done-by-default placeholders.
            steps.append(
                WorkflowStepResult(
                    id=step_id,
                    title=title,
                    status="done",
                    action="manual",
                    message="Manual drafting/revision step. Complete directly in the editor before proceeding.",
                )
            )

    # Return the full generated plan in the same order as WORKFLOW_STEPS.
    return WorkflowRunResponse(
        status="ready",
        summary=(
            "Workflow plan generated successfully. External tools require browser launch + manual completion; "
            "manual writing steps are marked complete-by-default for tracking."
        ),
        steps=steps,
    )