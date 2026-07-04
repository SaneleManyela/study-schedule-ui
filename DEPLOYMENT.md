# Deployment Plan — Study Planner

## Architecture

```
Browser
  │
  ├─── Static assets ──► GitHub Pages  (free, CDN, zero-cost)
  │                       https://SaneleManyela.github.io/academic-truth-engine-ui
  │
  └─── /api/* requests ──► Google Cloud Run  (free tier, scales to zero)
                            https://study-planner-api-<hash>-<region>.a.run.app
                                     │
                                     └── Firestore  (existing project: study-schedule-95688)
```

**Why these choices:**

| Service | Why |
|---------|-----|
| GitHub Pages | Completely free, already wired up (`npm run deploy`, base path set) |
| Google Cloud Run | Free tier covers ~2 M requests/month; scales to zero when idle; same Google project as Firestore |
| Firestore | Already in use; free tier is 50K reads + 20K writes + 20K deletes per day |

---

## Free tier limits (Cloud Run — as of 2026)

| Resource | Free per month |
|----------|---------------|
| Requests | 2,000,000 |
| Compute (CPU) | 180,000 vCPU-seconds |
| Compute (RAM) | 360,000 GB-seconds |
| Networking (egress) | 1 GB |

With `--min-instances 0` the service sleeps completely when there is no traffic. Cold start for this FastAPI image is ~2–4 seconds.

---

## One-time setup (do this once, then CI/CD handles everything)

### 1 — Install the Google Cloud CLI

```powershell
# Windows — download the installer from:
# https://cloud.google.com/sdk/docs/install
# Then restart your terminal and run:
gcloud init
gcloud auth login
```

### 2 — Enable required APIs

```powershell
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project study-schedule-95688
```

### 3 — Create an Artifact Registry repository for Docker images

```powershell
gcloud artifacts repositories create study-planner `
  --repository-format docker `
  --location us-central1 `
  --project study-schedule-95688
```

### 4 — Store secrets in Secret Manager

Run each command below, then paste the secret value when prompted.

```powershell
# Firebase service account JSON (paste the full JSON content)
gcloud secrets create firebase-service-account --data-file backend/service-account.json --project study-schedule-95688

# A stable random string — keeps session tokens valid across container restarts
$secret = [System.Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Max 256) }))
Write-Output $secret | gcloud secrets create session-secret --data-file=- --project study-schedule-95688

# Email credentials
Write-Output "smanyela44@gmail.com" | gcloud secrets create smtp-user --data-file=- --project study-schedule-95688
Write-Output "YOUR_NEW_SMTP_PASSWORD" | gcloud secrets create smtp-password --data-file=- --project study-schedule-95688
Write-Output "YOUR_NEW_RESEND_API_KEY" | gcloud secrets create resend-api-key --data-file=- --project study-schedule-95688
```

> **Replace `YOUR_NEW_SMTP_PASSWORD` and `YOUR_NEW_RESEND_API_KEY` with your freshly rotated credentials before running.**

### 5 — First manual deployment (to get the Cloud Run URL)

```powershell
# From the repo root
$REGION = "us-central1"
$PROJECT = "study-schedule-95688"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT/study-planner/api:v1"

cd backend
docker build -t $IMAGE .
docker push $IMAGE

gcloud run deploy study-planner-api `
  --image $IMAGE `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --min-instances 0 `
  --max-instances 2 `
  --memory 512Mi `
  --cpu 1 `
  --timeout 60 `
  --set-secrets "FIREBASE_SERVICE_ACCOUNT_JSON=firebase-service-account:latest,SESSION_SECRET=session-secret:latest,SMTP_USER=smtp-user:latest,SMTP_PASSWORD=smtp-password:latest,RESEND_API_KEY=resend-api-key:latest" `
  --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT" `
  --project $PROJECT

cd ..
```

Copy the service URL printed at the end — it looks like:
`https://study-planner-api-xxxxxxxxxx-uc.a.run.app`

### 6 — Deploy the frontend

```powershell
$env:VITE_API_BASE_URL = "https://study-planner-api-xxxxxxxxxx-uc.a.run.app"
npm run deploy
```

The app will be live at `https://SaneleManyela.github.io/academic-truth-engine-ui`.

---

## GitHub Actions CI/CD (automatic on every push to main)

The workflow at `.github/workflows/deploy.yml` runs both deployments automatically. Add these secrets to your GitHub repository at **Settings → Secrets and variables → Actions**:

| Secret name | Value |
|-------------|-------|
| `GCP_PROJECT_ID` | `study-schedule-95688` |
| `GCP_REGION` | `us-central1` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | See step A below |
| `GCP_SERVICE_ACCOUNT` | See step A below |
| `FIREBASE_PROJECT_ID` | `study-schedule-95688` |
| `VITE_API_BASE_URL` | Your Cloud Run service URL |

### Step A — Set up Workload Identity Federation (keyless auth from GitHub Actions)

This lets GitHub Actions deploy without a long-lived JSON key.

```powershell
# Create a service account for deployments
gcloud iam service-accounts create github-deployer `
  --display-name "GitHub Actions deployer" `
  --project study-schedule-95688

# Grant it the necessary roles
$SA = "github-deployer@study-schedule-95688.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding study-schedule-95688 --member "serviceAccount:$SA" --role roles/run.admin
gcloud projects add-iam-policy-binding study-schedule-95688 --member "serviceAccount:$SA" --role roles/artifactregistry.writer
gcloud projects add-iam-policy-binding study-schedule-95688 --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding study-schedule-95688 --member "serviceAccount:$SA" --role roles/iam.serviceAccountUser

# Create the Workload Identity Pool
gcloud iam workload-identity-pools create github-pool `
  --location global `
  --project study-schedule-95688

# Create the provider (replace YOUR_GITHUB_USERNAME)
gcloud iam workload-identity-pools providers create-oidc github-provider `
  --location global `
  --workload-identity-pool github-pool `
  --issuer-uri "https://token.actions.githubusercontent.com" `
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" `
  --attribute-condition "assertion.repository=='YOUR_GITHUB_USERNAME/academic-truth-engine-ui'" `
  --project study-schedule-95688

# Get the provider resource name — put this in GCP_WORKLOAD_IDENTITY_PROVIDER secret
gcloud iam workload-identity-pools providers describe github-provider `
  --location global `
  --workload-identity-pool github-pool `
  --project study-schedule-95688 `
  --format "value(name)"

# Allow GitHub to impersonate the deployer SA
$POOL_ID=$(gcloud iam workload-identity-pools describe github-pool --location global --project study-schedule-95688 --format "value(name)")
gcloud iam service-accounts add-iam-policy-binding $SA `
  --role roles/iam.workloadIdentityUser `
  --member "principalSet://iam.googleapis.com/$POOL_ID/attribute.repository/YOUR_GITHUB_USERNAME/academic-truth-engine-ui"
```

---

## Files created in this plan

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Multi-stage image: slim Python 3.12, installs deps, runs uvicorn on `$PORT` |
| `backend/.dockerignore` | Keeps secrets and caches out of the image |
| `.github/workflows/deploy.yml` | CI/CD: build → push → Cloud Run, then GitHub Pages |
| `backend/app/service.py` | `_SESSION_SECRET` now reads from `SESSION_SECRET` env var so tokens survive cold starts |

---

## Local dev is unchanged

Nothing about the local workflow changes. The Vite proxy (`/api → http://127.0.0.1:8000`) still handles all dev traffic. `VITE_API_BASE_URL` is only set at production build time.

---

## Render.com alternative (simpler, no GCP setup)

If GCP setup is too involved, Render's free tier is a one-click alternative:

1. Connect your GitHub repo at render.com
2. Create a **Web Service**, root directory: `backend`, runtime: **Docker**
3. Add the same env vars under Environment (paste JSON for `FIREBASE_SERVICE_ACCOUNT_JSON`)
4. Set **Scale to zero** = on (Render calls this "suspend when idle"; free tier enforces it)
5. Deploy — Render gives you a URL like `https://study-planner-api.onrender.com`
6. Set `VITE_API_BASE_URL` to that URL and run `npm run deploy`

**Trade-off:** Render free tier has a ~50-second cold start (vs ~4 seconds on Cloud Run). Cloud Run is the better option if you have a Google account.