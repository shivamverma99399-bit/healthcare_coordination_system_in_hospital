# MEDPULSE Frontend

This is the Vite + React frontend for MEDPULSE.

## Stack

- React 19
- React Router 7
- Vite 6
- Axios
- Tailwind CSS
- Framer Motion

## Scripts

Run these inside `frontend/`:

```powershell
npm install
npm run dev
npm run build
npm run preview
```

## Local Development

Create a local env file:

```powershell
Copy-Item .env.example .env
```

Example:

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_DEV_PROXY_TARGET=
```

Start the frontend:

```powershell
npm run dev
```

Default dev URL:

- `http://localhost:5173`

## API Configuration

The frontend uses:

- [src/config/api.js](e:\PROJECTS\hospital\frontend\src\config\api.js#L1)

Rules:

- `VITE_API_URL` should be the backend base URL
- do not append `/api` to `VITE_API_URL`
- production should not rely on the Vite dev proxy

Example production value:

```env
VITE_API_URL=https://healthcare-coordination-system-in.onrender.com
```

## Demo Auth Notes

The current UI includes a frontend-only demo auth experience:

- patient login uses local validation and `localStorage`
- admin login uses local validation and `localStorage`
- logout clears the stored session

Some demo-only dashboard behaviors also use `localStorage`, including PDF uploads and local UI persistence.

## Deployment

Deploy this frontend from:

- project root on Vercel: `frontend`

Routing rewrites are handled by:

- [vercel.json](e:\PROJECTS\hospital\frontend\vercel.json)

Required Vercel env var:

```env
VITE_API_URL=https://your-render-backend.onrender.com
```

## Related Docs

- [Project README](e:\PROJECTS\hospital\README.md)
- [Deployment Guide](e:\PROJECTS\hospital\DEPLOYMENT.md)
