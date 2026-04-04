## MEDPULSE Deployment

Use:

- Render for the Django backend
- Vercel for the Vite frontend

### Backend on Render

The backend is configured through [render.yaml](/e:/PROJECTS/hospital/render.yaml).

Render service details:

- root directory: `healthcare_system`
- build command: `bash build.sh`
- start command: `gunicorn healthcare_system.wsgi:application`
- health check path: `/api/auth/demo-accounts`

Set these backend environment variables in Render:

- `DJANGO_SECRET_KEY`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `GEMINI_API_KEY` if you want Gemini analysis
- `DATABASE_URL=sqlite:///db.sqlite3`

The current blueprint uses SQLite only. No Render Postgres or Supabase database is required.

### Local SQLite

For local development, the backend uses SQLite through:

- `DATABASE_URL=sqlite:///healthcare_system/db.sqlite3`

Suggested value for `DJANGO_CSRF_TRUSTED_ORIGINS` after the frontend is deployed:

- `https://your-vercel-app.vercel.app`

### Frontend on Vercel

Frontend project root:

- `frontend/frontend`

Set this Vercel environment variable:

- `VITE_API_BASE_URL=https://your-render-backend.onrender.com/api`

The SPA rewrite config is in [vercel.json](/e:/PROJECTS/hospital/frontend/frontend/vercel.json) so React Router routes work on refresh.

### Deploy Order

1. Push this repo to GitHub.
2. Create the Render backend first.
3. Copy the backend Render URL.
4. Create the Vercel frontend with `frontend/frontend` as the root directory.
5. Add `VITE_API_BASE_URL` in Vercel using your Render backend URL plus `/api`.
6. Update Render `DJANGO_CSRF_TRUSTED_ORIGINS` with your Vercel frontend URL.
7. Redeploy both services.

### Notes

- Django static files are served through WhiteNoise.
- Production and local development both use SQLite unless you explicitly point `DATABASE_URL` elsewhere.
- Local `.env` is separate from Render and Vercel dashboard environment variables.
