# Deployment Plan — Study Planner

## Architecture

```
Browser
  │
  ├─── Static assets ──► GitHub Pages  (free, CDN, zero-cost)
  │                       https://SaneleManyela.github.io/study-schedule-ui
  │
  └─── /api/* requests ──► Render.com  (free tier, scales to zero)
                            https://study-planner-api.onrender.com
                                     │
                                     └── Firestore  (project: study-schedule-95688)
```

**Why these choices:**

| Service | Why |
|---------|-----|
| GitHub Pages | Completely free, already wired up (`npm run deploy`) |
| Render.com | Free tier with 750 hours/month; scales to zero when idle; no billing account required; simpler setup |
| Firestore | Already in use; free tier is 50K reads + 20K writes + 20K deletes per day |

---

## Render.com free tier limits

| Resource | Free per month |
|----------|---------------|
| Web Services | 750 hours (enough for 1 service running 24/7) |
| Sleep on idle | Yes, after 15 minutes of inactivity |
| Cold start | ~50 seconds (vs ~4 seconds on Cloud Run) |

---

## One-time setup (do this once, then CI/CD handles everything)

### 1 — Set up Render.com (using render.yaml)

The easiest way is to use the `render.yaml` file in the `backend/` directory:

1. Go to [render.com](https://render.com) and sign up with GitHub
2. Click **New** → **Blueprint**
3. Connect your repository: `SaneleManyela/study-schedule-ui`
4. Render will automatically detect the `backend/render.yaml` file
5. Review and confirm the service configuration
6. Add the secret values when prompted:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` - Your Firebase service account JSON
   - `SMTP_PASSWORD` - Your SMTP password
   - `RESEND_API_KEY` - Your Resend API key

**Alternative: Manual setup**

If you prefer manual setup, click **New** → **Web Service** and configure:
   - **Name**: `study-planner-api`
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Region**: Choose closest to your users
   - **Plan**: Free
   - **Auto Deploy**: On (or use manual for control)

### 2 — Add Environment Variables

In the Render dashboard, add these environment variables:

| Name | Value |
|------|-------|
| `FIREBASE_PROJECT_ID` | `study-schedule-95688` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | (Paste your Firebase service account JSON) |
| `SESSION_SECRET` | (Random 32-character string) |
| `SMTP_USER` | `smanyela44@gmail.com` |
| `SMTP_PASSWORD` | (Your SMTP password) |
| `SMTP_HOST` | `smtp.gmail.com` (or your custom SMTP server) |
| `SMTP_PORT` | `465` (or your custom SMTP port) |
| `RESEND_API_KEY` | (Your Resend API key - optional fallback) |

### 3 — Get Render API Key and Service ID

1. In Render dashboard, go to **Account Settings** → **API Keys**
2. Create a new API key and copy it
3. Go to your service and copy the **Service ID** from the URL:
   - URL format: `https://dashboard.render.com/web/services/`**`srv-xxxxxxxxxx`**`/...`
   - The Service ID is `srv-xxxxxxxxxx`

### 4 — Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** and add:

| Secret name | Value |
|-------------|-------|
| `RENDER_API_KEY` | Your Render API key from step 3 |
| `RENDER_SERVICE_ID` | Your Render Service ID from step 3 |
| `VITE_API_BASE_URL` | Your Render service URL (e.g., `https://study-planner-api.onrender.com`) |

### 5 — First manual deployment

1. Push to main branch or trigger manual deploy in Render dashboard
2. Wait for the build to complete (~2-3 minutes)
3. Copy the service URL from the Render dashboard

### 6 — Deploy the frontend

```powershell
# Set the API URL and deploy
npm run deploy
```

The app will be live at `https://SaneleManyela.github.io/study-schedule-ui`.

---

## GitHub Actions CI/CD (automatic on every push to main)

The workflow at `.github/workflows/deploy.yml` runs both deployments automatically:

1. **Backend**: Triggers a new deploy on Render using the API
2. **Frontend**: Builds and deploys to GitHub Pages

---

## Files created in this plan

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Multi-stage image: slim Python 3.12, installs deps, runs uvicorn on `$PORT` |
| `backend/.dockerignore` | Keeps secrets and caches out of the image |
| `backend/render.yaml` | Render.com blueprint configuration for automatic setup |
| `.github/workflows/deploy.yml` | CI/CD: Render deploy trigger → GitHub Pages |

---

## Local dev is unchanged

Nothing about the local workflow changes. The Vite proxy (`/api → http://127.0.0.1:8000`) still handles all dev traffic. `VITE_API_BASE_URL` is only set at production build time.

---

## Troubleshooting

### Service sleeps after inactivity

This is expected on Render's free tier. The first request after sleep will take ~50 seconds to wake up.

### Environment variables not working

Make sure to set them in the Render dashboard under your service's **Environment** tab, not in the Dockerfile.

### CORS errors

If you see CORS errors, ensure your frontend is deployed to the correct URL and the backend allows requests from that origin.