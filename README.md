
  # Admin Page Interface Design

  This is a code bundle for Admin Page Interface Design. The original project is available at https://www.figma.com/design/EiSDoYlrv4I4GDRQ1Vv7rm/Admin-Page-Interface-Design.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Truth Engine features

  The app now includes a dedicated Truth Engine page at `/` with:

  - assignment workflow tracking (11 steps)
  - required email capture for external tool account setup
  - external tool launch actions per workflow step
  - one-click `Launch Phase Tools` action to open the next phase links
  - workflow audit trail with timestamped action logs
  - rich text editor with autosave
  - export actions: `DOCX` and `PDF`

  The legacy workbench is still available at `/workbench`.

  ## FastAPI backend

  This workspace now includes a backend bridge in `backend/`.

  Install backend dependencies:

  ```powershell
  pip install -r backend/requirements.txt
  ```

  Run the API server:

  ```powershell
  & "C:/Users/SMANYEL/Admin Page Interface Design/.venv/Scripts/python.exe" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
  ```

  The React app calls `http://127.0.0.1:8000` by default.
  To change it, set `VITE_API_BASE_URL` in your frontend environment.

  ### Backend endpoints

  - `GET /api/health`: health check
  - `POST /api/research/query`: research answer packet
  - `POST /api/workflow/run`: operational Truth Engine workflow plan

  `POST /api/workflow/run` validates the email, returns step-by-step actions, and marks external-tool steps as `in-progress` with launch hints while keeping manual-writing steps actionable inside the editor.
  