  # Academic Truth Engine UI

  Academic Truth Engine UI is a Vite + React frontend with a FastAPI backend bridge for running research and assignment workflow actions.

  ## What this repo includes

  - `src/`: React application UI and routing
  - `backend/`: FastAPI service used by the frontend
  - `guidelines/`: Project guidelines and reference material
  - `dist/`: Build output (generated frontend assets)

  ## App routes

  The UI is organized as two systems:

  - System 1 (Evidence-first research pipeline)
    - `/research/workbench`: main research pipeline interface
    - `/research/ask`: focused Q&A interface
    - `/research/admin`: research configuration interface

  - System 2 (Assignment workflow studio)
    - `/assignment/workflow`: assignment execution and quality workflow

  Entry route:

  - `/`: Systems home (choose between the two systems)

  Legacy aliases kept for compatibility:

  - `/workbench`, `/ask`, `/admin`, `/truth-engine`

  ## Prerequisites

  - Node.js 18+ (or newer LTS)
  - npm 9+
  - Python 3.11+ recommended

  ## Quick start

  Install frontend dependencies:

  ```powershell
  npm install
  ```

  Create and activate a Python virtual environment (optional but recommended):

  ```powershell
  python -m venv .venv
  & .\.venv\Scripts\Activate.ps1
  ```

  Install backend dependencies:

  ```powershell
  pip install -r backend/requirements.txt
  ```

  Start backend API:

  ```powershell
  uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
  ```

  In a second terminal, start the frontend:

  ```powershell
  npm run dev
  ```

  Frontend default URL: `http://127.0.0.1:5173`

  ## Frontend scripts

  - `npm run dev`: start development server
  - `npm run build`: create production build

  ## Backend API

  Base URL (default): `http://127.0.0.1:8000`

  - `GET /api/health`: health check
  - `POST /api/research/query`: returns a research response packet
  - `POST /api/workflow/run`: returns assignment workflow execution plan

  ## Environment configuration

  The frontend uses this variable for API requests:

  - `VITE_API_BASE_URL` (optional)

  If not set, the app uses `http://127.0.0.1:8000`.

  ## Notes

  - CORS is currently configured for `http://localhost:5173` and `http://127.0.0.1:5173` in `backend/app/main.py`.
  - The backend service logic is in `backend/app/service.py`.
  