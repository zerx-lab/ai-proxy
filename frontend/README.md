# AI Proxy Frontend

TanStack Start + Vite + React + TypeScript + Radix UI + Tailwind CSS.

## Setup

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev   # Vite dev server on http://localhost:3000
```

## Production build

```bash
npm run build
# Emits dist/client/ (browser bundle) and dist/server/ (SSR bundle)
```

## Environment

| Variable       | Default                  | Description          |
|----------------|--------------------------|----------------------|
| `VITE_API_URL` | `http://localhost:4000`  | Backend base URL     |

Create a `.env.local` in this directory to override:

```
VITE_API_URL=http://your-backend.example.com
```

## Routes

| Path        | Auth required | Description                        |
|-------------|---------------|------------------------------------|
| `/login`    | No            | Login / signup (toggle)            |
| `/`         | Yes           | Dashboard – stats cards            |
| `/keys`     | Yes           | API key list, create, toggle, delete |
| `/accounts` | Admin only    | Claude accounts – OAuth / session key / API key |
| `/audit`    | Yes           | Audit log table                    |
