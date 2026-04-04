# MEDPULSE

MEDPULSE is a two-role healthcare coordination platform built with:

- `Django + Django REST Framework` for the backend
- `Vite + React` for the frontend
- `SQLite` for the current default database
- `Render` for backend deployment
- `Vercel` for frontend deployment

The app supports patient and hospital-admin workflows including symptom triage, hospital discovery, appointment coordination, SOS escalation, record handling, and demo-friendly local UI flows.

## Project Structure

```text
hospital/
|- frontend/                  # Vite + React frontend
|- healthcare_system/         # Django project and app code
|- .env.example               # Backend env example
|- render.yaml                # Render deployment blueprint
|- DEPLOYMENT.md              # Deployment guide
```

## Features

- Patient symptom intake and hospital recommendations
- Hospital detail and doctor availability views
- Patient dashboard for appointments, SOS updates, and local PDF uploads
- Hospital admin portal for appointments, patient records, and resource updates
- Demo-friendly frontend auth flows stored in `localStorage`
- Admin-to-patient file sharing in the frontend demo flow

## Tech Stack

### Frontend

- React 19
- React Router 7
- Vite 6
- Axios
- Tailwind CSS
- Framer Motion

### Backend

- Django 6
- Django REST Framework
- Gunicorn
- WhiteNoise

## Prerequisites

- `Node.js 18+`
- `npm`
- `Python 3.11+` recommended
- `pip`
- Optional: a virtual environment

## Local Setup

### 1. Clone and enter the project

```powershell
git clone <your-repo-url>
cd hospital
```

### 2. Backend setup

Create and activate a virtual environment if you want an isolated Python setup:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Install backend dependencies:

```powershell
cd healthcare_system
pip install -r requirements.txt
```

Create a backend `.env` from the root example if you need custom values:

```powershell
cd ..
Copy-Item .env.example .env
```

Important backend env vars:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DATABASE_URL`
- `RUN_SEED_DATA`
- `RUN_SEED_DEMO_ACCESS`

Run migrations:

```powershell
cd healthcare_system
..\venv\Scripts\python.exe manage.py migrate
```

Optionally seed demo/local data:

```powershell
..\venv\Scripts\python.exe manage.py seed_data
..\venv\Scripts\python.exe manage.py seed_demo_access
```

Start the backend server:

```powershell
..\venv\Scripts\python.exe manage.py runserver
```

Backend default local URL:

- `http://127.0.0.1:8000`

### 3. Frontend setup

In a new terminal:

```powershell
cd frontend
npm install
```

Create the frontend env file if needed:

```powershell
Copy-Item .env.example .env
```

Current frontend env vars:

- `VITE_API_URL`
- `VITE_DEV_PROXY_TARGET`

Run the frontend:

```powershell
npm run dev
```

Frontend default local URL:

- `http://localhost:5173`

## Environment Configuration

### Backend `.env`

Use the root `.env.example` as the template.

Typical local values:

```env
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:5173
DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=sqlite:///healthcare_system/db.sqlite3
RUN_SEED_DATA=1
RUN_SEED_DEMO_ACCESS=1
```

### Frontend `.env`

Use `frontend/.env.example` as the template.

Typical local values:

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_DEV_PROXY_TARGET=
```

Production-style example:

```env
VITE_API_URL=https://healthcare-coordination-system-in.onrender.com
```

## Running the App

Start both servers:

1. Backend on `http://127.0.0.1:8000`
2. Frontend on `http://localhost:5173`

The frontend reads the backend base URL from:

- [frontend/src/config/api.js](e:\PROJECTS\hospital\frontend\src\config\api.js#L1)

## Demo Auth Behavior

The current frontend includes a demo-oriented local authentication layer.

- Patient login is frontend-only and stored in `localStorage`
- Admin login is frontend-only and stored in `localStorage`
- Logout clears the local session
- Some dashboard conveniences, such as uploaded PDF files, also use `localStorage`

This means:

- demo login does not require backend auth to succeed
- uploaded PDFs and other demo-only local items are browser-local
- a different browser or cleared storage will not retain local demo data

## Useful Commands

### Frontend

```powershell
cd frontend
npm run dev
npm run build
npm run preview
```

### Backend

```powershell
cd healthcare_system
..\venv\Scripts\python.exe manage.py runserver
..\venv\Scripts\python.exe manage.py migrate
..\venv\Scripts\python.exe manage.py test
```

## Deployment

Deployment is split across:

- `Render` for the Django backend
- `Vercel` for the Vite frontend

See:

- [DEPLOYMENT.md](e:\PROJECTS\hospital\DEPLOYMENT.md)

## Troubleshooting

### Frontend calls the wrong backend

Check:

- `frontend/.env`
- Vercel project env var `VITE_API_URL`

The frontend should point to the backend base URL, not `/api` on the Vercel domain.

### PDF upload fails

The patient/admin file upload demo uses `localStorage`.

- only PDFs are supported
- each PDF should stay under `2 MB`
- browser storage limits can still cause failures

### CORS errors in production

Check backend env vars:

- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_CORS_ALLOWED_ORIGINS`

Make sure they include the exact Vercel frontend URL.

## Notes

- The backend currently defaults to SQLite unless `DATABASE_URL` is changed.
- `render.yaml` is configured for Render blueprint deployment.
- The frontend has a `vercel.json` rewrite so React Router routes work on refresh.
