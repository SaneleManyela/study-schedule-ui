from pydantic import BaseModel, Field


class DocumentIn(BaseModel):
    id: str
    name: str
    type: str
    url: str
    uploadedAt: str


class ProfileIn(BaseModel):
    name: str = ""
    email: str = ""
    organization: str = ""
    projectTitle: str = ""
    researchFocus: str = ""
    notes: str = ""


class SettingsIn(BaseModel):
    replicateApiToken: str = ""
    preferredModel: str = "ibm-granite/granite-3.1-8b-instruct"
    notebookPath: str = ""
    enableOcrFallback: bool = True
    tesseractReady: bool = False
    popplerReady: bool = False


class ResearchQueryRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=3000)
    documents: list[DocumentIn] = Field(default_factory=list)
    settings: SettingsIn
    profile: ProfileIn


class ResearchResponse(BaseModel):
    title: str
    summary: str
    evidence: list[str]
    nextAction: str


class HealthResponse(BaseModel):
    status: str
    mode: str


class WorkflowStepResult(BaseModel):
    id: int
    title: str
    status: str
    action: str
    message: str
    launchUrl: str | None = None


class WorkflowRunRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)


class WorkflowRunResponse(BaseModel):
    status: str
    summary: str
    steps: list[WorkflowStepResult]