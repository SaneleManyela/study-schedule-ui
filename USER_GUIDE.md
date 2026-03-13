# Academic Truth Engine — User Guide

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Installation & Setup](#3-installation--setup)
   - 3.1 [Frontend Setup](#31-frontend-setup)
   - 3.2 [Backend Setup](#32-backend-setup)
4. [Navigating the Interface](#4-navigating-the-interface)
5. [Admin Panel — First-Time Configuration](#5-admin-panel--first-time-configuration)
   - 5.1 [Engine Configuration](#51-engine-configuration)
   - 5.2 [Research Profile](#52-research-profile)
   - 5.3 [Source Registry](#53-source-registry)
6. [Workbench — Main Research Interface](#6-workbench--main-research-interface)
   - 6.1 [Readiness Dashboard](#61-readiness-dashboard)
   - 6.2 [Notebook Command Deck](#62-notebook-command-deck)
   - 6.3 [Step 3 — Source Intake](#63-step-3--source-intake)
   - 6.4 [Step 6 — Research Loop](#64-step-6--research-loop)
   - 6.5 [Notebook Pipeline Mirror](#65-notebook-pipeline-mirror)
   - 6.6 [Query History](#66-query-history)
7. [Ask Page — Focused Q&A](#7-ask-page--focused-qa)
8. [Truth Engine — Assignment Workflow](#8-truth-engine--assignment-workflow)
   - 8.1 [Tool Stack Overview](#81-tool-stack-overview)
   - 8.2 [Running the Workflow](#82-running-the-workflow)
   - 8.3 [Rich Text Editor](#83-rich-text-editor)
   - 8.4 [Audit Trail](#84-audit-trail)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

The Academic Truth Engine is a research workbench that bridges a React-based UI with a Python notebook backend. It helps researchers:

- Manage PDF and Google Drive source documents.
- Query sources using a language model (IBM Granite via Replicate).
- Track an 11-step academic writing workflow across multiple AI tools.
- Export polished drafts as `.docx` or PDF.

The application has four pages accessible from the top menu bar:

| Page | Route | Purpose |
|---|---|---|
| Truth Engine | `/` | Assignment workflow orchestrator with a built-in editor |
| Workbench | `/workbench` | Main research interface mirroring the Python notebook |
| Ask | `/ask` | Clean, focused Q&A against your sources |
| Admin | `/admin` | Configuration and settings |

---

## 2. Prerequisites

### System Requirements

| Requirement | Purpose |
|---|---|
| **Node.js 18+** | Running the frontend dev server |
| **Python 3.10+** | Running the FastAPI backend |
| **Tesseract OCR** | Optional — PDF image-to-text fallback |
| **Poppler** | Optional — Required by Tesseract for PDF-to-image conversion |

### Accounts & Tokens

| Service | Purpose | Cost |
|---|---|---|
| **Replicate** | Hosts the IBM Granite model | Pay-per-use |
| **NotebookLM** | Understands your brief/rubric | Free |
| **Perplexity** | Web research with citations | Free |
| **Claude** | Structured outline generation | Free |
| **Ryne** | Readability and style review | Free |
| **Citely** | Citation validation | Credit-based |
| **DripWriter** | Version history in Google Docs | Free |

You will need a **Replicate API token** before you can run live research queries. Get one at [replicate.com](https://replicate.com).

---

## 3. Installation & Setup

### 3.1 Frontend Setup

1. Open a terminal in the project root (`Academic-Truth-Engine-UI/`).

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Create a `.env.local` file if your backend runs on a non-default port:
   ```env
   VITE_API_BASE_URL=http://127.0.0.1:8000
   ```
   If this file is omitted, the frontend defaults to `http://127.0.0.1:8000`.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser to `http://localhost:5173`.

### 3.2 Backend Setup

1. Open a second terminal in the `backend/` directory.

2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS / Linux
   source .venv/bin/activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Launch the API server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

5. Verify the server is running by visiting `http://127.0.0.1:8000/api/health` — you should see:
   ```json
   { "status": "ok", "mode": "bridge" }
   ```

> **Note:** The frontend and backend must both be running for live queries to work. If the backend is unavailable, the UI falls back to a local response explaining what configuration is missing.

---

## 4. Navigating the Interface

The **menu bar** at the top of every page provides navigation:

- **File → Refresh** — Reloads all state from local storage without a full page reload.
- **Truth Engine** — Go to the assignment workflow page.
- **Workbench** — Go to the main research interface.
- **Ask** — Go to the focused Q&A interface.
- **Admin** — Go to the settings and configuration panel.

All settings and data (documents, profile, query history) are stored in your browser's **local storage**, so they persist between sessions on the same machine without any database.

---

## 5. Admin Panel — First-Time Configuration

Navigate to **Admin** (`/admin`) before using the Workbench for the first time.

### 5.1 Engine Configuration

| Field | Description |
|---|---|
| **Replicate API Token** | Your personal token from replicate.com. Stored securely in local storage. |
| **Granite Model** | The model identifier sent to Replicate. Default: `ibm-granite/granite-3.1-8b-instruct`. Change only if you want a different model version. |
| **Notebook Path** | Absolute path to your local `.ipynb` file. Used by the pipeline mirror to display notebook context. |
| **OCR Fallback** | Toggle on to allow Tesseract to extract text from image-based PDFs. |
| **Tesseract Ready** | Toggle on once Tesseract is installed and available on your system `PATH`. |
| **Poppler Ready** | Toggle on once Poppler is installed (required for Tesseract PDF processing). |

### 5.2 Research Profile

Fill in your identity fields so that every research query includes proper context:

| Field | Description |
|---|---|
| **Full Name** | Your name (included in query payloads). |
| **Email** | Used to launch workflow tools with your account. |
| **Organization** | Your institution or company. |
| **Project Title** | The name of your current research project. |
| **Research Focus** | A short description of your research topic. Displayed in the Workbench Command Deck. |
| **Notes** | Any additional context to pass to the research loop. |

### 5.3 Source Registry

Displays a read-only table of all documents you have uploaded or linked in the Workbench. From here you can:
- Review which sources are registered.
- Click **Open Workbench** to add new sources if the registry is empty.

Click **Save Changes** at the bottom of the Admin page to persist your configuration. A confirmation toast will appear in the top-right corner.

**Readiness indicator** (top of Admin page):

| Status | Meaning |
|---|---|
| Configuration required | No Replicate API token has been saved. |
| Awaiting sources | Token saved but no documents uploaded yet. |
| Workbench ready for backend wiring | Token and at least one source are present. |

---

## 6. Workbench — Main Research Interface

Navigate to **Workbench** (`/workbench`). This page mirrors the Python notebook pipeline and is where day-to-day research happens.

### 6.1 Readiness Dashboard

The hero card at the top shows three key metrics:

| Metric | How it is calculated |
|---|---|
| **Readiness %** | Weighted average of the 6 pipeline stage completion scores. |
| **Sources** | Number of PDFs and Drive links currently registered. |
| **Queries Logged** | Number of entries in your query history. |

Use this dashboard to get a quick sense of whether the workbench is ready to produce meaningful results.

### 6.2 Notebook Command Deck

The right-side panel summarises your current configuration at a glance:

- **Model** — The Granite model identifier currently saved.
- **Token** — Shows "Configured" (green) or "Missing" (red).
- **OCR** — Shows "Enabled" or "Disabled".
- **Notebook** — The filesystem path to your `.ipynb` file.
- **Research Focus** — The focus text from your Research Profile.

### 6.3 Step 3 — Source Intake

This section manages the documents the language model will reason over.

**Adding PDF files:**
- Drag one or more `.pdf` files onto the dashed upload zone, or click the zone to open a file picker.
- Only PDF files are accepted.
- Each file appears as a card showing its name and upload timestamp.

**Adding Google Drive links:**
- Paste a Google Drive shareable link into the input field.
- Supported URL formats:
  - `https://drive.google.com/file/d/<FILE_ID>/view`
  - `https://drive.google.com/open?id=<FILE_ID>`
- Click **Add Link**. The document appears in the source list immediately.

**Managing sources:**
- Click the **trash icon** on a source card to remove it.
- Click **View source** to open the original file or Drive URL.

> **Tip:** Ensure PDFs are text-based (not scanned images) for best results. Enable OCR fallback in Admin if you need to process scanned documents.

### 6.4 Step 6 — Research Loop

This is where you send questions to the backend for analysis.

1. Type your question into the textarea, or click one of the **quick question chips** to prefill a common query.
2. Click **Ask notebook**.
3. The **execution console** displays live status lines as the request is processed.
4. The **Latest Response** panel shows:
   - **Title** — A short label for the response.
   - **Summary** — The model's narrative answer.
   - **Evidence** — A bulleted list of supporting points extracted from your sources.
   - **Next Action** — A suggested follow-up step.

Each successful query is automatically saved to Query History.

> **Fallback behaviour:** If the backend is unreachable or prerequisites are missing (no token, no sources), the UI generates a local response explaining what is needed rather than showing a generic error.

### 6.5 Notebook Pipeline Mirror

The right column shows the six pipeline stages and their current status:

| Stage | What it tracks |
|---|---|
| 1. Runtime Dependencies | Whether Tesseract and Poppler are marked ready. |
| 2. Model Configuration | Whether a Replicate token is saved. |
| 3. Source Ingestion | Whether at least one document is uploaded. |
| 4. Semantic Chunking | Derived from source availability. |
| 5. Fusion Retrieval | Requires both sources and a token. |
| 6. Research Loop | Tracks whether queries have been asked. |

Each stage displays:
- A **progress bar** showing completion percentage.
- A **status badge**: `Ready` (green), `Attention needed` (yellow), or `Blocked` (red).
- A description and detail line explaining what is required.

### 6.6 Query History

At the bottom of the page, all past queries are listed with their question text, timestamp, and the response summary. The history is capped at the most recent entries to keep local storage manageable.

---

## 7. Ask Page — Focused Q&A

Navigate to **Ask** (`/ask`) for a cleaner, distraction-free version of the research loop.

The page reuses your existing sources, settings, and profile from local storage — no re-configuration needed.

**Quick question presets on this page:**
- "What is the central argument supported by the uploaded source?"
- "List the strongest evidence in the source without adding external claims."
- "What limitations, contradictions, or gaps are explicitly stated in the document?"

**Using the Ask page:**
1. Review the **Research Context** panel (right side) to confirm your sources and model are loaded.
2. Type a question or click a preset chip.
3. Click **Ask now**.
4. Read the response in the **Latest Answer** panel.
5. Scroll down to **Recent Questions** to review your session history.

Use this page when you want to focus purely on querying without the pipeline stages visible.

---

## 8. Truth Engine — Assignment Workflow

Navigate to **Truth Engine** (`/`) for the full academic writing workflow.

### 8.1 Tool Stack Overview

Six external tools are integrated into the workflow:

| Tool | Purpose | Cost |
|---|---|---|
| **NotebookLM** | Upload brief/rubric; understand requirements | Free |
| **Perplexity** | Research phase with cited sources | Free |
| **Claude** | Build a structured essay outline | Free |
| **Ryne** | Readability and academic style review | Free |
| **Citely** | Validate and format citations | Credit-based |
| **DripWriter** | Version history in Google Docs | Free |

### 8.2 Running the Workflow

The workflow has **11 steps** organised into three phases:

**Phase 1 — Research Setup (Steps 1–3)**
1. Upload your brief or rubric to NotebookLM.
2. Research your topic in Perplexity with full citation tracking.
3. Use Claude to generate a structured outline from your research.

**Phase 2 — Draft and Evaluation (Steps 4–6)**

4. Write your essay draft (manual step in the editor below).
5. Send the draft to bolt.new for formatting.
6. Re-check the formatted draft against your rubric in NotebookLM.

**Phase 3 — Verification and Finalization (Steps 7–11)**

7. Run a Ryne readability and style review.
8. Validate all citations with Citely.
9. Make manual revisions based on feedback.
10. Commit a version snapshot in DripWriter.
11. Run a final Ryne pass to confirm quality.

**Workflow controls:**

| Action | Description |
|---|---|
| **Enter account email + Save** | Your email is used to pre-fill sign-in prompts when tool URLs are launched. |
| **Launch tool** (per step) | Opens the step's external tool URL and marks the step as "In Progress". |
| **Launch phase tools** | Opens all tool URLs for the next incomplete phase at once. |
| **Run All** | Calls the backend (`POST /api/workflow/run`), which returns per-step statuses and launch URLs for every step simultaneously. |
| **Step status badge** | Click a badge to cycle through: `Todo → In Progress → Done`. |

The **completion percentage** in the hero card updates in real time as steps are marked done.

### 8.3 Rich Text Editor

Below the workflow steps is a full rich text editor for writing your draft:

| Control | Function |
|---|---|
| **B** | Bold |
| **I** | Italic |
| **U** | Underline |
| **Bullets** | Unordered list |
| **Numbers** | Ordered list |
| **H2** | Heading 2 |
| **¶** | Normal paragraph |
| **Tx** | Clear all formatting |
| **Export DOCX** | Saves the editor content as a `.docx` file via the `docx` library |
| **Export PDF** | Opens a print dialog pre-loaded with the editor HTML for PDF save |

Your draft is automatically saved to local storage as you type and survives page refreshes.

### 8.4 Audit Trail

Every action (step status changes, workflow runs, tool launches) is logged to an **Audit Trail** at the bottom of the Truth Engine page. The trail shows:
- Timestamp of the action.
- Action type badge (e.g., "step-update", "workflow-run").
- A short description of what changed.

The trail retains the most recent 20 entries.

---

## 9. Troubleshooting

### Queries return a local fallback instead of real results

- Verify the backend is running at `http://127.0.0.1:8000`.
- Check that a Replicate API token is saved in Admin.
- Ensure at least one source document is uploaded in the Workbench.

### "Configuration required" shown in Admin

- A Replicate API token has not been saved. Enter your token in **Admin → Engine Configuration → Replicate API Token** and click **Save Changes**.

### PDF drag-and-drop not working

- Only `.pdf` files are accepted. Confirm the file extension.
- Try using the click-to-upload fallback instead of drag-and-drop.

### Google Drive link rejected or not parsing

- Ensure the link is a standard shareable URL in one of these formats:
  - `https://drive.google.com/file/d/<ID>/view`
  - `https://drive.google.com/open?id=<ID>`
- Make sure the file is shared with "Anyone with the link" in Google Drive.

### OCR is not extracting text from PDFs

- Confirm Tesseract is installed and on your system `PATH`.
- Confirm Poppler is installed and on your system `PATH`.
- Enable both **Tesseract ready** and **Poppler ready** toggles in Admin and click **Save Changes**.
- Restart the backend after enabling OCR tools.

### Workflow Run returns "blocked" status

- This means the email address saved in the Truth Engine page is invalid. Re-enter a valid email in the Account Email field and click **Save**, then retry **Run All**.

### Settings not persisting after refresh

- The app relies on browser local storage. If your browser is set to clear storage on close (private/incognito mode), data will not persist between sessions. Use a standard browser window.

### CORS error in browser console

- The backend only accepts requests from `http://localhost:5173` and `http://127.0.0.1:5173`. Make sure the frontend dev server is running on port `5173` (the Vite default).
- If you changed the port, update the `origins` list in `backend/app/main.py` accordingly.
