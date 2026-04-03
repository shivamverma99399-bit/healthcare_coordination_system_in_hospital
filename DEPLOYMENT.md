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

Render will provide `DATABASE_URL` from the Postgres database declared in the blueprint.

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
- Production uses Postgres when `DATABASE_URL` is present.
- Local `.env` is separate from Render and Vercel dashboard environment variables.
