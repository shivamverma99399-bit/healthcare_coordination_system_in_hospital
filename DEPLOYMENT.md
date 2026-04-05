# MEDPULSE Deployment

MEDPULSE deploys as:

- `Render` for the Django backend
- `Vercel` for the React frontend
- `Supabase PostgreSQL` for the database

The backend must connect only to PostgreSQL with `sslmode=require`. The frontend must call the Render backend directly through `VITE_API_URL`.

## Backend on Render

Use [render.yaml](/e:/PROJECTS/hospital/render.yaml) or configure the service manually:

- Root directory: `backend`
- Build command: `bash build.sh`
- Start command: `bash start.sh`
- Health check path: `/api/health`

### Required Render Environment Variables

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG=0`
- `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://your-vercel-app.vercel.app,https://your-render-backend.onrender.com`
- `DJANGO_CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app`
- `DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?sslmode=require`
- `DJANGO_LOG_LEVEL=INFO`

Optional:

- `RUN_SEED_DATA=1`
- `GEMINI_API_KEY`

### Backend Validation

After deployment:

1. Open `https://your-render-backend.onrender.com/api/health`
2. Confirm the response is `200`
3. Confirm the response payload includes `"database": "ok"`
4. Review Render logs to verify migrations completed successfully

## Frontend on Vercel

Deploy the `frontend` directory and set:

- `VITE_API_URL=https://your-render-backend.onrender.com`

Rules:

- Do not point `VITE_API_URL` at the Vercel domain
- Do not include `/api` in `VITE_API_URL`
- React Router refresh support is provided by [frontend/vercel.json](/e:/PROJECTS/hospital/frontend/vercel.json)

## Recommended Deployment Order

1. Provision Supabase and copy the PostgreSQL connection string.
2. Deploy the backend to Render with the required environment variables.
3. Confirm `/api/health` is healthy.
4. Deploy the frontend to Vercel.
5. Set `VITE_API_URL` in Vercel to the Render backend base URL.
6. Update Render CORS and CSRF variables with the exact Vercel URL.
7. Redeploy if any environment variable changed.

## Production Verification Checklist

1. Patient login succeeds.
2. Hospital recommendations load without CORS or auth errors.
3. Appointment booking writes data and appears in the patient dashboard.
4. Patient PDF upload previews and deletes correctly.
5. Session persists after a full page reload.
6. Hospital admin login succeeds.
7. Admin overview loads the assigned hospital correctly.
8. Admin patient-record PDF upload is visible to the patient.

## Common Issues

### 401 or invalid session behavior

- Confirm the frontend sends `Authorization: Token <token>`
- Confirm the backend URL in `VITE_API_URL` is correct

### CORS or preflight failures

- Check `DJANGO_CORS_ALLOWED_ORIGINS`
- Check `DJANGO_CSRF_TRUSTED_ORIGINS`
- Make sure the exact Vercel URL is configured

### Database connection failures

- Check `DATABASE_URL`
- Confirm it is PostgreSQL, not SQLite
- Confirm `sslmode=require` is included
