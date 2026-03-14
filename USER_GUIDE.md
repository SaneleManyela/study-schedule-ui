# Academic Truth Engine - Complete User Guide

This guide is rebuilt from scratch using:
- the UI repository documentation in README.md
- the notebook repository documentation in Academic-Truth-Engine-v2/Academic-Truth-Engine/ReadMe.md

It explains how to run the UI, connect the backend bridge, and operate the Workbench with notebook-aligned expectations.

## 1. System Overview

You are working with two connected layers:

1. UI Layer (this repository)
- Vite + React frontend
- FastAPI bridge backend
- Routes: `/`, `/workbench`, `/ask`, `/admin`

2. Notebook Layer (Academic Truth Engine v2)
- 8-cell notebook workflow for ingestion, chunking, retrieval, and Q&A
- Replicate + Granite model runtime
- OCR fallback path for low-text PDFs

Practical meaning:
- The UI captures inputs and sends payloads.
- Grounded model execution must happen in Python services/notebook flow.

## 2. Prerequisites

## 2.1 Required

- Node.js 18+
- npm 9+
- Python 3.11+ recommended

## 2.2 Optional but Important

- Tesseract OCR executable
- Poppler utilities (`pdftoppm` or `pdftocairo`)

These are needed when OCR fallback is enabled for scanned/image-based PDFs.

## 3. Quick Start (UI Repository)

Run commands from this workspace root.

## 3.1 Install frontend dependencies

```powershell
npm install
```

## 3.2 Create and activate virtual environment

```powershell
python -m venv .venv
& .\.venv\Scripts\Activate.ps1
```

## 3.3 Install backend dependencies

```powershell
pip install -r backend/requirements.txt
```

## 3.4 Start backend API

```powershell
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

## 3.5 Start frontend (second terminal)

```powershell
npm run dev
```

Default UI URL:
- `http://127.0.0.1:5173`

Backend health endpoint:
- `http://127.0.0.1:8000/api/health`

Expected response:

```json
{ "status": "ok", "mode": "bridge" }
```

## 3.6 Optional API base override

If required, create `.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

If omitted, frontend already defaults to `http://127.0.0.1:8000`.

## 4. Notebook v2 Context You Should Follow

The notebook is documented as an 8-stage execution path:

1. Install runtime dependencies.
2. Initialize console logging helpers.
3. Validate Tesseract and Poppler diagnostics.
4. Configure Granite (Replicate) and embeddings.
5. Ingest Google Drive PDF with fallback and PDF header validation.
6. Build semantic chunks with metadata.
7. Initialize query rewriting retriever pack.
8. Run interactive Q&A loop.

Why this matters in UI:
- Workbench mirrors the same lifecycle conceptually (config, ingestion, retrieval readiness, Q&A).
- If the Python execution path is unavailable, the UI cannot produce full grounded inference by itself.

## 5. First-Time UI Configuration (Admin Page)

Open `/admin` and configure before using Workbench.

## 5.1 Engine Configuration

Set:
1. Replicate API token
2. Granite model id
3. Notebook path
4. OCR fallback toggle
5. Tesseract ready toggle
6. Poppler ready toggle

## 5.2 Research Profile

Set:
1. Full name
2. Email
3. Organization
4. Project title
5. Research focus
6. Notes

Save with **Save Changes**.

Readiness labels:
- Configuration required
- Awaiting sources
- Workbench ready for backend wiring

## 6. Workbench Usage (Main Interface)

Open `/workbench`.

The page is split into:
1. Hero metrics
2. Notebook Command Deck
3. Step 3 Source Intake
4. Step 6 Research Loop
5. Notebook Pipeline Mirror
6. Query History

## 6.1 Source Intake (Step 3)

You can add:
- PDF files (drag/drop or click browse)
- Google Drive links

PDF rules:
- Only `application/pdf` accepted

Drive naming behavior:
- If ID parsed from `/d/<id>` or `?id=<id>`, name is `Drive source <id>`
- Otherwise, name is `Linked research source`

Per-source controls:
- Delete source
- View source

## 6.2 Research Loop (Step 6)

Flow:
1. Enter a question or choose quick prompt.
2. Click **Ask notebook**.
3. UI sends payload to `/api/research/query`.
4. Response renders in Latest response panel.

Payload includes:
- question
- documents
- settings
- profile

History behavior:
- Workbench stores latest 6 entries.

## 6.3 Pipeline Mirror

Stages displayed:
1. Runtime Dependencies
2. Model Configuration
3. Source Ingestion
4. Semantic Chunking
5. Fusion Retrieval
6. Research Loop

Stage status values:
- `ready`
- `attention`
- `blocked`

Use these to identify exactly what prerequisite is missing.

## 7. Ask Page (Focused Querying)

Open `/ask` for a simplified question-answer workflow.

It uses the same local data model:
- documents
- settings
- profile
- history

Use this page when you only need fast querying without full workbench context panels.

## 8. Truth Engine Page (Assignment Workflow)

Open `/` for the multi-step assignment workflow and editor.

Key actions:
1. Save account email.
2. Run all workflow steps via backend endpoint `/api/workflow/run`.
3. Launch per-step external tools.
4. Draft in embedded rich text editor.
5. Export DOCX/PDF.

## 8.1 DOCX Export Behavior (Current Implementation)

Current DOCX export uses `docx` package and:
1. reads editor `innerText`
2. splits into lines
3. writes plain paragraphs
4. downloads `truth-engine-assignment.docx`

Result:
- rich formatting is flattened in DOCX output

PDF export path prints editor HTML and usually preserves visual structure better.

## 9. Local Storage Model

The UI persists data in browser localStorage.

Important keys:
- `documents`
- `researchSettings`
- `profile`
- `queryHistory`
- legacy: `apiKey`

If browser storage is cleared or private mode is used, data may disappear.

## 10. CORS and Connectivity Notes

Backend CORS currently allows:
- `http://localhost:5173`
- `http://127.0.0.1:5173`

If frontend origin changes, update backend CORS list accordingly.

## 11. Troubleshooting Matrix

## 11.1 Fallback responses instead of grounded backend output

Check:
1. backend running on `127.0.0.1:8000`
2. Replicate token configured
3. at least one source uploaded

## 11.2 Drive ingestion fails

In notebook-aligned flow, sharing permissions matter.

Set Google Drive file to:
- Anyone with the link -> Viewer

## 11.3 OCR not working

Check all:
1. Tesseract installed
2. Poppler installed
3. OCR toggles enabled in Admin

## 11.4 CORS errors

Confirm frontend and backend are using allowed origins and expected ports.

## 12. Recommended Daily Run Sequence

1. Start backend API.
2. Start frontend server.
3. Verify `/api/health`.
4. Confirm Admin token/model/path settings.
5. Upload source PDFs/links in Workbench.
6. Ask evidence-grounded questions.
7. Check stage statuses and adjust missing prerequisites.
8. Use Ask page or Truth Engine page as needed.

This sequence keeps UI behavior aligned with the notebook v2 operational model.
