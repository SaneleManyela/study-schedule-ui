export interface ResearchDocument {
  id: string;
  name: string;
  type: "file" | "link";
  url: string;
  uploadedAt: string;
}

export interface ResearchProfile {
  name: string;
  email: string;
  organization: string;
  projectTitle: string;
  researchFocus: string;
  notes: string;
}

export interface ResearchSettings {
  replicateApiToken: string;
  preferredModel: string;
  notebookPath: string;
  enableOcrFallback: boolean;
  tesseractReady: boolean;
  popplerReady: boolean;
}

export interface ResearchResponse {
  title: string;
  summary: string;
  evidence: string[];
  nextAction: string;
}

export interface QueryHistoryItem {
  id: string;
  question: string;
  createdAt: string;
  response: ResearchResponse;
}

export interface NotebookStage {
  id: string;
  title: string;
  description: string;
  detail: string;
  status: "ready" | "attention" | "blocked";
  completion: number;
}

const STORAGE_KEYS = {
  documents: "documents",
  profile: "profile",
  settings: "researchSettings",
  history: "queryHistory",
  legacyApiKey: "apiKey",
} as const;

const defaultProfile: ResearchProfile = {
  name: "",
  email: "",
  organization: "",
  projectTitle: "Academic Truth Engine",
  researchFocus: "Evidence-grounded academic analysis",
  notes: "",
};

const defaultSettings: ResearchSettings = {
  replicateApiToken: "",
  preferredModel: "ibm-granite/granite-3.1-8b-instruct",
  notebookPath:
    "c:/Users/SMANYEL/Academic-Truth-Engine-v2/Academic-Truth-Engine/Academic_Truth_Engine_v2.ipynb",
  enableOcrFallback: true,
  tesseractReady: false,
  popplerReady: false,
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadDocuments(): ResearchDocument[] {
  if (!canUseStorage()) {
    return [];
  }

  return safeParse<ResearchDocument[]>(localStorage.getItem(STORAGE_KEYS.documents), []);
}

export function saveDocuments(documents: ResearchDocument[]) {
  if (!canUseStorage()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(documents));
}

export function loadResearchProfile(): ResearchProfile {
  if (!canUseStorage()) {
    return defaultProfile;
  }

  const saved = safeParse<Partial<ResearchProfile>>(localStorage.getItem(STORAGE_KEYS.profile), {});
  return {
    ...defaultProfile,
    ...saved,
  };
}

export function saveResearchProfile(profile: ResearchProfile) {
  if (!canUseStorage()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

export function loadResearchSettings(): ResearchSettings {
  if (!canUseStorage()) {
    return defaultSettings;
  }

  const legacyApiKey = localStorage.getItem(STORAGE_KEYS.legacyApiKey) ?? "";
  const saved = safeParse<Partial<ResearchSettings>>(localStorage.getItem(STORAGE_KEYS.settings), {});

  return {
    ...defaultSettings,
    ...saved,
    replicateApiToken: saved.replicateApiToken ?? legacyApiKey,
  };
}

export function saveResearchSettings(settings: ResearchSettings) {
  if (!canUseStorage()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function loadQueryHistory(): QueryHistoryItem[] {
  if (!canUseStorage()) {
    return [];
  }

  return safeParse<QueryHistoryItem[]>(localStorage.getItem(STORAGE_KEYS.history), []);
}

export function saveQueryHistory(history: QueryHistoryItem[]) {
  if (!canUseStorage()) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
}

export function formatTimestamp(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createLinkDocument(url: string): ResearchDocument {
  const driveId = extractDriveFileId(url);

  return {
    id: `${Date.now()}-${Math.random()}`,
    name: driveId ? `Drive source ${driveId}` : "Linked research source",
    type: "link",
    url,
    uploadedAt: new Date().toISOString(),
  };
}

function extractDriveFileId(url: string) {
  const patterns = [/\/d\/([A-Za-z0-9_-]+)/, /[?&]id=([A-Za-z0-9_-]+)/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

export function getNotebookStages(input: {
  documents: ResearchDocument[];
  settings: ResearchSettings;
  queryHistory: QueryHistoryItem[];
}): NotebookStage[] {
  const { documents, settings, queryHistory } = input;
  const hasSources = documents.length > 0;
  const hasToken = settings.replicateApiToken.trim().length > 0;
  const ocrReady = settings.tesseractReady && settings.popplerReady;

  return [
    {
      id: "step-1",
      title: "Step 1: Runtime Dependencies",
      description: "Notebook packages and OCR utilities must be available before ingestion starts.",
      detail: ocrReady
        ? "Tesseract and Poppler are marked ready for OCR fallback."
        : settings.enableOcrFallback
          ? "OCR fallback is enabled, but one or more system tools still need installation."
          : "OCR fallback is disabled, so only extractable-text PDFs are expected.",
      status: ocrReady || !settings.enableOcrFallback ? "ready" : "attention",
      completion: ocrReady || !settings.enableOcrFallback ? 100 : 58,
    },
    {
      id: "step-2",
      title: "Step 2: Model Configuration",
      description: "Replicate and Granite settings mirror the notebook security and model setup.",
      detail: hasToken
        ? `Model configured for ${settings.preferredModel}.`
        : "Replicate API token is still missing.",
      status: hasToken ? "ready" : "blocked",
      completion: hasToken ? 100 : 24,
    },
    {
      id: "step-3",
      title: "Step 3: Source Ingestion",
      description: "Sources can come from uploaded PDFs or Google Drive links.",
      detail: hasSources
        ? `${documents.length} source${documents.length === 1 ? "" : "s"} queued for ingestion.`
        : "No PDFs or shared links have been added yet.",
      status: hasSources ? "ready" : "blocked",
      completion: hasSources ? 100 : 10,
    },
    {
      id: "step-4",
      title: "Step 4: Semantic Chunking",
      description: "The notebook splits source content into retrieval-ready semantic nodes.",
      detail: hasSources
        ? "Source files are ready to become chunked research nodes once the Python runner is connected."
        : "Chunking remains blocked until at least one source file is available.",
      status: hasSources ? "attention" : "blocked",
      completion: hasSources ? 76 : 0,
    },
    {
      id: "step-5",
      title: "Step 5: Fusion Retrieval",
      description: "Sequential query rewriting depends on both indexed nodes and model access.",
      detail: hasSources && hasToken
        ? "The frontend has enough configuration to hand off a fusion query to a backend service."
        : "Both source material and a Replicate token are required to enable retrieval.",
      status: hasSources && hasToken ? "attention" : "blocked",
      completion: hasSources && hasToken ? 70 : 0,
    },
    {
      id: "step-6",
      title: "Step 6: Research Loop",
      description: "The final grounded answer is produced by the notebook runtime, not React itself.",
      detail:
        queryHistory.length > 0
          ? `${queryHistory.length} question${queryHistory.length === 1 ? "" : "s"} captured in the interface history.`
          : "No questions have been submitted from the GUI yet.",
      status: hasSources && hasToken ? "attention" : "blocked",
      completion: queryHistory.length > 0 ? 82 : hasSources && hasToken ? 64 : 0,
    },
  ];
}

export function createResearchResponse(input: {
  question: string;
  documents: ResearchDocument[];
  settings: ResearchSettings;
  profile: ResearchProfile;
}): ResearchResponse {
  const { question, documents, settings, profile } = input;
  const hasSources = documents.length > 0;
  const hasToken = settings.replicateApiToken.trim().length > 0;
  const sourceNames = documents.slice(0, 3).map((document) => document.name).join(", ");
  const missing: string[] = [];

  if (!hasToken) {
    missing.push("a Replicate API token");
  }

  if (!hasSources) {
    missing.push("at least one source PDF or Drive link");
  }

  if (missing.length > 0) {
    return {
      title: "Notebook execution is not ready",
      summary: `The GUI captured your question, but React cannot execute the Python notebook by itself. Add ${missing.join(" and ")} before wiring this screen to a Python API or notebook runner.`,
      evidence: [
        `Question captured: ${question}`,
        `Configured model: ${settings.preferredModel}`,
        `Notebook target: ${settings.notebookPath}`,
      ],
      nextAction:
        "Complete the missing setup, then connect the Ask action to a backend endpoint that calls the notebook pipeline or extracted Python functions.",
    };
  }

  return {
    title: "Interface packet prepared for grounded analysis",
    summary:
      "The React workbench now mirrors the notebook workflow: configuration, source ingestion, and the research question are collected in one place. The remaining step is a Python execution layer that runs chunking, retrieval, and Granite inference.",
    evidence: [
      `Question queued: ${question}`,
      `Primary sources: ${sourceNames || `${documents.length} sources ready`}`,
      `Project: ${profile.projectTitle || "Academic Truth Engine"}`,
      `Model handoff: ${settings.preferredModel}`,
    ],
    nextAction:
      "POST these inputs to a Python service that runs notebook Steps 3-6 and returns the grounded answer plus citations.",
  };
}