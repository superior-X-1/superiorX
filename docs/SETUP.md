# Measure X — Deployment & Setup Guide (SIH26036)

This comprehensive guide walks through setting up **Measure X (SuperiorX)** across the production cloud architecture:
- **Frontend** → **Vercel**
- **Backend** → **Render**
- **Database** → **Supabase PostgreSQL**
- **File Storage** → **Supabase Storage**
- **Source Control** → **GitHub**

---

## 1. Cloud Architecture Overview

```text
Browser (Desktop / Mobile / Scanner)
  │
  ├─────────────────────────────────────────┐
  │ Static Assets (HTML/CSS/JS/PWA)         │ API Requests (REST + JWT)
  ▼                                         ▼
Vercel (Frontend CDN)                  Render (FastAPI Backend)
                                            │
                                            ├──► Supabase PostgreSQL (ACID Relational DB)
                                            └──► Supabase Storage (Evidence & Documents Bucket)
```

---

## 2. Supabase Setup (Database & Storage)

### Step 2.1: Create Project
1. Log in to [Supabase](https://supabase.com) and click **New Project**.
2. Select an organization, choose a database password, and select your preferred region.

### Step 2.2: Run Database Migration
1. Go to **SQL Editor** in the Supabase Dashboard.
2. Open the file `backend/schema.sql` (or `backend/migrations/001_initial_supabase_postgres.sql`) from this repository.
3. Paste the contents into the SQL Editor and click **Run**.
4. Confirm that all 23 tables are listed under **Table Editor**.

### Step 2.3: Configure Supabase Storage Bucket
1. Navigate to **Storage** in the Supabase Dashboard.
2. Click **Create new bucket**:
   - Name: `measurex-storage`
   - Public bucket: **Enabled** (or configure signed URL access as required).
3. The backend uses the REST API endpoint `POST /storage/v1/object/measurex-storage/...` using your service role key.

### Step 2.4: Collect Supabase Connection Credentials
Navigate to **Project Settings** $\to$ **API** and **Database**:
- `DATABASE_URL`: Connection string under **Database** $\to$ **Connection string** (URI). Select `psycopg` or format as `postgresql+psycopg://postgres:[PASSWORD]@[HOST]:[PORT]/postgres`.
- `SUPABASE_URL`: Project URL (e.g. `https://your-project-ref.supabase.co`).
- `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key (never expose on frontend).
- `SUPABASE_STORAGE_BUCKET`: `measurex-storage`.

---

## 3. Render Setup (FastAPI Backend)

### Step 3.1: Create Web Service
1. Log in to [Render](https://render.com) and click **New +** $\to$ **Web Service**.
2. Connect your GitHub repository.
3. Configure service settings:
   - **Name**: `superiorx-backend`
   - **Region**: Choose closest to your Supabase region
   - **Branch**: `main`
   - **Root Directory**: `.` (leave empty or specify repository root)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

### Step 3.2: Configure Environment Variables on Render
Add the following under **Environment Variables** in Render:

| Variable | Description | Example / Note |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string | `postgresql+psycopg://postgres:xxx@db.yyy.supabase.co:5432/postgres` |
| `SUPABASE_URL` | Supabase Project URL | `https://your-project-ref.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key | Secure API key |
| `SUPABASE_STORAGE_BUCKET` | Supabase Storage Bucket Name | `measurex-storage` |
| `JWT_SECRET` | Secret key for JWT signing | 64-character random string |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session validity duration | `1440` (24 hours) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `https://your-frontend.vercel.app,http://localhost:3000` |
| `DIGITAL_SIGNATURE_PRIVATE_KEY_PEM` | RSA-2048 PEM private key | Include full PEM string with `\n` |
| `PUBLIC_VERIFY_BASE_URL` | Public verification URL for QR codes | `https://your-frontend.vercel.app/#verify?id=` |

### Step 3.3: Verify Deployment
Once deployed, verify the health endpoint:
```bash
curl https://your-backend.onrender.com/api/v1/health
# Response: {"status":"healthy","database":"connected",...}
```

---

## 4. Vercel Setup (Frontend)

### Step 4.1: Import Project to Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New...** $\to$ **Project**.
2. Select your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Other`
   - **Root Directory**: `frontend` (or leave as root; `vercel.json` will automatically direct to `frontend/`)
   - **Build Command**: Leave blank (pure static files)
   - **Output Directory**: Leave blank (or `.` if root is `frontend`)

### Step 4.2: Deploy
1. Click **Deploy**.
2. Once deployed, note your Vercel URL (e.g. `https://your-app.vercel.app`).
3. If necessary, add this URL to Render's `ALLOWED_ORIGINS` environment variable.

---

## 5. Local Development Setup

### Step 5.1: Clone and Configure
```bash
git clone <your-repo-url>
cd mx
cp .env.example .env
```

### Step 5.2: Install Backend Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### Step 5.3: Start FastAPI Backend
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### Step 5.4: Start Frontend Server
```bash
cd frontend && python3 -m http.server 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Troubleshooting & Common Questions

1. **Database connection errors (`ModuleNotFoundError: No module named 'psycopg'`):**
   - Ensure you installed `backend/requirements.txt` which includes `psycopg[binary]>=3.1.18`.
2. **CORS errors in browser console:**
   - Verify that your Vercel URL is included in the Render `ALLOWED_ORIGINS` environment variable without trailing slashes.
3. **Storage upload failures:**
   - Confirm that the bucket `measurex-storage` exists in your Supabase dashboard and `SUPABASE_SERVICE_ROLE_KEY` is correctly set.
   - In local development without Supabase credentials, the backend automatically falls back to local disk (`storage/uploads/`).
4. **Digital Signature generation:**
   - In production on Render, set `DIGITAL_SIGNATURE_PRIVATE_KEY_PEM`.
   - In local development, the backend automatically generates a local keypair in `backend/keys/` if not present.
