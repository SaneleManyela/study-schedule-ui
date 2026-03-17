"""Pydantic schema models for backend request/response payloads.

These models provide:
1) Runtime validation for incoming JSON.
2) Type-safe structures used by service code.
3) OpenAPI documentation emitted by FastAPI.
"""

from pydantic import BaseModel, Field


class DocumentIn(BaseModel):
    """One source item supplied by the frontend.

    Source items can represent uploaded PDFs or URL-based references.
    """

    # Client-side generated identifier for tracking and rendering.
    id: str
    # Human-readable display name shown in the interface.
    name: str
    # Source type label (for example: "file" or "link").
    type: str
    # Blob URL or external URL pointing to the source.
    url: str
    # ISO timestamp indicating when the source was added.
    uploadedAt: str


class ProfileIn(BaseModel):
    """User/project profile context attached to a research query."""

    # Optional user name used for project context and personalization.
    name: str = ""
    # Optional contact email captured from frontend profile settings.
    email: str = ""
    # Organization or institution context (if provided).
    organization: str = ""
    # User-defined project title displayed in the UI.
    projectTitle: str = ""
    # Free-text research focus statement.
    researchFocus: str = ""
    # Extra notes from the user profile.
    notes: str = ""


class SettingsIn(BaseModel):
    """Runtime configuration values needed for notebook orchestration."""

    # API token used by the external inference provider.
    replicateApiToken: str = ""
    # Preferred model identifier selected in the frontend settings.
    preferredModel: str = "ibm-granite/granite-3.1-8b-instruct"
    # Path to notebook file used by the current workflow setup.
    notebookPath: str = ""
    # Toggle for OCR fallback behavior.
    enableOcrFallback: bool = True
    # Whether Tesseract dependency is available.
    tesseractReady: bool = False
    # Whether Poppler dependency is available.
    popplerReady: bool = False


class ResearchQueryRequest(BaseModel):
    """Incoming payload for POST /api/research/query."""

    # The actual user question. Guardrails limit very short and very large input.
    question: str = Field(..., min_length=5, max_length=3000)
    # Source list can be empty, but service layer may return "not ready" guidance.
    documents: list[DocumentIn] = Field(default_factory=list)
    # Runtime settings selected in the frontend admin/workbench.
    settings: SettingsIn
    # User/project context sent alongside query settings.
    profile: ProfileIn


class ResearchResponse(BaseModel):
    """Response payload returned to Ask/Main pages for rendering."""

    # Primary response heading.
    title: str
    # Main explanatory summary paragraph.
    summary: str
    # Evidence/support bullets used in frontend card list.
    evidence: list[str]
    # Suggested follow-up action for the user.
    nextAction: str


class HealthResponse(BaseModel):
    """Simple backend health status payload."""

    # High-level status flag (for example: "ok").
    status: str
    # Indicates service role/mode for UI display.
    mode: str


class WorkflowStepResult(BaseModel):
    """One step result entry in workflow orchestration output."""

    # Stable step number for ordering and UI linkage.
    id: int
    # Human-readable instruction title.
    title: str
    # Step state (for example: done, in-progress, blocked).
    status: str
    # Action key used by frontend behavior (for example: open-url).
    action: str
    # Detailed instruction message for the user.
    message: str
    # Optional URL to launch the external tool for this step.
    launchUrl: str | None = None


class WorkflowRunRequest(BaseModel):
    """Incoming payload for POST /api/workflow/run."""

    # Account email used in workflow step messaging and validation.
    email: str = Field(..., min_length=5, max_length=320)


class WorkflowRunResponse(BaseModel):
    """Top-level workflow response container."""

    # Overall workflow readiness state.
    status: str
    # Summary sentence explaining run outcome.
    summary: str
    # Ordered list of generated workflow step outputs.
    steps: list[WorkflowStepResult]