# MEDPULSE Deployment

MEDPULSE is deployed with:

- `Render` for the Django backend
- `Vercel` for the Vite frontend

This document reflects the current project layout and env variable names.

## Deployment Overview

### Backend

- Framework: `Django`
- Root directory on Render: `healthcare_system`
- Build command: `bash build.sh`
- Start command: `bash start.sh`
- Health check path: `/api/health`

Render blueprint file:

- [render.yaml](e:\PROJECTS\hospital\render.yaml)

### Frontend

- Framework: `Vite + React`
- Vercel project root: `frontend`
- SPA rewrite config:
  - [frontend/vercel.json](e:\PROJECTS\hospital\frontend\vercel.json)

## Backend Deployment on Render

### 1. Create the service

Use the Render blueprint or create a web service manually with:

- Root directory: `healthcare_system`
- Build command: `bash build.sh`
- Start command: `bash start.sh`

### 2. Configure backend environment variables

Required:

- `DJANGO_SECRET_KEY`

Recommended:

- `DJANGO_DEBUG=0`
- `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,healthcare-coordination-system-in.onrender.com`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://your-vercel-app.vercel.app,https://your-render-backend.onrender.com`
- `DJANGO_CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app`
- `DATABASE_URL=sqlite:///db.sqlite3`

Optional:

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-1.5-flash`
- `RUN_SEED_DATA=1`
- `RUN_SEED_DEMO_ACCESS=1`

### 3. Database note

The current setup defaults to SQLite.

- No Render Postgres is required for the current repo setup
- Persistent production data on SQLite has operational limitations, so plan a database upgrade later if the app grows

## Frontend Deployment on Vercel

### 1. Create the project

Use:

- Root directory: `frontend`

### 2. Configure frontend environment variables

Required:

- `VITE_API_URL=https://your-render-backend.onrender.com`

Optional for local-only proxying:

- `VITE_DEV_PROXY_TARGET=`

Important:

- Do not set `VITE_API_URL` to the Vercel domain
- Do not append `/api` manually in the env var
- The frontend builds API URLs internally from `VITE_API_URL`

### 3. Routing support

React Router refreshes are handled by:

- [frontend/vercel.json](e:\PROJECTS\hospital\frontend\vercel.json)

## Recommended Deploy Order

1. Push the repo to GitHub.
2. Deploy the backend on Render first.
3. Copy the final Render backend URL.
4. Deploy the frontend on Vercel with `frontend` as the root directory.
5. Add `VITE_API_URL` in Vercel using the Render backend base URL.
6. Update Render CORS and CSRF env vars with the exact Vercel URL.
7. Redeploy both services if env vars changed after the initial build.

## Current Production Example

Backend:

- `https://healthcare-coordination-system-in.onrender.com`

Frontend:

- `https://healthcare-coordination-system-in-hospital-3kfrm74g.vercel.app`

## Production Checklist

- Render backend is healthy at `/api/health`
- Vercel has `VITE_API_URL` set
- Render has the exact Vercel domain in:
  - `DJANGO_CSRF_TRUSTED_ORIGINS`
  - `DJANGO_CORS_ALLOWED_ORIGINS`
- Static files are collected successfully
- Migrations run successfully

## Common Issues

### Frontend shows 404 from Vercel domain

Cause:

- API calls are going to relative paths on Vercel

Fix:

- Set `VITE_API_URL` to the Render backend URL

### CORS or preflight failures

Cause:

- Missing or incorrect Vercel URL in backend CORS/CSRF config

Fix:

- Update:
  - `DJANGO_CSRF_TRUSTED_ORIGINS`
  - `DJANGO_CORS_ALLOWED_ORIGINS`

### Frontend build uses old env values

Cause:

- Vite injects env values at build time

Fix:

- update env vars
- trigger a new Vercel deployment

## Helpful References

- [README.md](e:\PROJECTS\hospital\README.md)
- [frontend/.env.example](e:\PROJECTS\hospital\frontend\.env.example)
- [.env.example](e:\PROJECTS\hospital\.env.example)
