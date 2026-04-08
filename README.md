# DentaFlow AI

AI-Powered Dental Treatment Planning Platform for Doctors.

## Architecture

- **Backend:** Python 3.11+ / FastAPI / PostgreSQL / SQLAlchemy / Alembic / Redis / Celery
- **Frontend:** React 18 / TypeScript 5 / Vite / Tailwind CSS / Zustand / TanStack Query
- **3D Rendering:** Three.js / React Three Fiber
- **Auth:** JWT access tokens + httponly refresh cookies

## Project Structure

```
backend/app/
  constants.py       # Single source of truth for all constants
  config.py          # Pydantic Settings + env vars
  models/            # SQLAlchemy ORM models
  schemas/           # Pydantic request/response schemas
  repositories/      # Data access layer (Repository pattern)
  services/          # Business logic layer
  api/v1/            # Route handlers (thin layer)
  middleware/         # Auth, rate limiting

frontend/src/
  constants/         # App-wide constants (APP_NAME, colors, etc)
  lib/               # Shared utilities (api, queryClient, utils)
  types/             # Shared TypeScript types
  components/ui/     # Reusable UI components
  modules/           # Feature modules (auth, cases, billing, etc)
  layouts/           # Page layout shells
```

Each module in `modules/` is self-contained with its own types, hooks, services, store, components, and pages. Import only from the module's `index.ts`.

## Quick Start

### With Docker

```bash
cp .env.example .env
docker-compose up -d
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Without Docker

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## User Roles

| Role | Access |
|------|--------|
| SUPER_ADMIN | Full platform access |
| DENTIST | Upload cases, review results, billing |
| TECHNICIAN | Process cases, design work |
| LAB_MANAGER | Manage technicians, quality oversight |

## Maintainer: M. Umair
Actively maintaining, updating, and improving the project
