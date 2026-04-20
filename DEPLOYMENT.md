# SAMS.AI — Production Deployment Guide

## Architecture

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend  | Vercel   | `https://sams-ai.vercel.app` |
| Backend   | Hugging Face Spaces (Docker) | `https://sagarswain05-sams-ai.hf.space` |
| Database  | Neon.tech (PostgreSQL) | Internal |

---

## Step 1 — Neon.tech PostgreSQL Database

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project → name it `sams-ai`
3. Copy the **Connection string** (starts with `postgres://...`)
4. Run the seed script against Neon (replace `$NEON_URL`):
   ```bash
   cd backend
   source venv/bin/activate
   DATABASE_URL="$NEON_URL" python seed_college.py
   ```
   This creates all 712 users, 15 sections, 450 schedule slots.

---

## Step 2 — Hugging Face Spaces (Backend)

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces) → **Create new Space**
2. Settings:
   - Owner: `SagarSwain05`
   - Name: `sams-ai`
   - SDK: **Docker**
   - Hardware: **T4 GPU** (for face recognition) or **CPU Upgrade** (16GB RAM)
   - Visibility: Public
3. Connect to GitHub repo: `SagarSwain05/SAMS.AI` → subdirectory `backend/`
4. Add **Secrets** (Space Settings → Variables and secrets):

   | Key | Value |
   |-----|-------|
   | `SECRET_KEY` | (generate: `python -c "import secrets; print(secrets.token_hex(32))"`) |
   | `JWT_SECRET_KEY` | (generate same way) |
   | `DATABASE_URL` | Your Neon connection string |
   | `CORS_ORIGINS` | `https://sams-ai.vercel.app,http://localhost:5173` |
   | `FLASK_ENV` | `production` |
   | `PORT` | `7860` |
   | `CAMERA_INDEX` | `-1` (no physical camera on HF — use IoT/kiosk mode) |

5. Space auto-builds from `backend/Dockerfile`. Takes ~5 min first time.
6. Health check: `https://sagarswain05-sams-ai.hf.space/api/health`

---

## Step 3 — Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → **Import Git Repository**
2. Select `SagarSwain05/SAMS.AI`
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://sagarswain05-sams-ai.hf.space/api` |

5. Click **Deploy** — frontend goes live in ~2 min.

---

## Step 4 — Post-deployment Checklist

- [ ] `GET https://sagarswain05-sams-ai.hf.space/api/health` returns `{"status":"ok","database":"connected"}`
- [ ] Login with `college_admin` / `Admin@2024` works on production URL
- [ ] Teacher login + attendance marking works
- [ ] Student login + dashboard shows attendance
- [ ] CORS: no browser console errors about blocked origins
- [ ] WebSocket connects (check browser DevTools → Network → WS)

---

## Environment Files (local development)

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your local DB URL

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env — for local, leave VITE_API_URL blank (defaults to localhost:5001)
```

---

## ML Models Note

The InsightFace Buffalo-L ONNX models (~500MB) are **not stored in git** (too large).

- **On HF Spaces**: InsightFace downloads them automatically on first `FaceAnalysis()` call.
  The Space's persistent storage at `/data/` keeps them across restarts.
- **Locally**: Models live at `backend/models_v2/models/` — generated on first run.

To pre-seed face enrollments on production, use the **Student Registration** form in
Admin Dashboard → it captures webcam frames, extracts embeddings, and stores them in
the Neon database as `face_embeddings` rows (no file storage needed for ArcFace).

---

## Updating Production

```bash
# Push changes to GitHub → both Vercel and HF Spaces auto-redeploy
git add .
git commit -m "feat: your change"
git push origin main
```

Vercel redeploys in ~1 min. HF Spaces redeploys in ~3-5 min.
