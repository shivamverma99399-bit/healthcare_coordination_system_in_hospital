# MEDPULSE

MEDPULSE is a React + Django healthcare coordination platform with patient and hospital-admin workflows. The app is now structured as a strict two-app repo:

- `frontend/` for the Vite + React client
- `backend/` for the Django + DRF API

The backend is PostgreSQL-only and expects a Supabase connection string with SSL enabled. Authentication uses `Authorization: Token <token>`, and PDF documents are stored server-side and served through authenticated API endpoints.

## Architecture

```text
hospital/
|- frontend/                  # Vite + React
|- backend/                   # Django project, app, migrations, scripts
|- render.yaml                # Render blueprint for the backend
|- DEPLOYMENT.md              # Production deployment guide
```

## Key Flows

- Patient login or first-time patient profile creation
- Symptom analysis and ranked hospital recommendations
- Doctor availability and appointment booking
- Patient dashboard for appointments, SOS alerts, and PDF documents
- Hospital admin overview, profile, resource updates, patient records, and inter-hospital transfers
- Admin-to-patient PDF sharing backed by the database

## Local Setup

### 1. Backend

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1

cd backend
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `backend/.env` with your Supabase PostgreSQL connection:

```env
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?sslmode=require
RUN_SEED_DATA=1
DJANGO_SECURE_SSL_REDIRECT=0
```

Run migrations and optional seed commands:

```powershell
..\venv\Scripts\python.exe manage.py migrate
..\venv\Scripts\python.exe manage.py seed_data
```

Start the API:

```powershell
..\venv\Scripts\python.exe manage.py runserver
```

### 2. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

Set the frontend env:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start the client:

```powershell
npm run dev
```

## Environment Rules

### Frontend

- `VITE_API_URL` is required
- Set it to the backend base URL only, not `/api`
- The app builds all endpoints from [frontend/src/config/api.js](/e:/PROJECTS/hospital/frontend/src/config/api.js)

### Backend

- `DATABASE_URL` must be PostgreSQL
- SQLite is not supported
- `sslmode=require` is expected for Supabase
- Production must use Render environment variables, not a checked-in `.env`

## File Uploads

- Only PDF uploads are accepted
- Patient uploads are stored in the backend and shown in the patient dashboard
- Admin uploads are attached to patient records and become visible to the patient
- Documents are previewed through authenticated download endpoints and can be deleted according to role permissions

## Verification Commands

```powershell
# Backend
cd backend
..\venv\Scripts\python.exe manage.py migrate
..\venv\Scripts\python.exe manage.py test

# Frontend
cd frontend
npm install
npm run build
```

## Deployment

Use:

- Render for the Django backend
- Vercel for the React frontend

See [DEPLOYMENT.md](/e:/PROJECTS/hospital/DEPLOYMENT.md) for the exact production steps.
