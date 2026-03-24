# DentaFlow AI — Multi-stage Docker build
# Stage 1: Build frontend
# Stage 2: Production backend + serve frontend static files

# ─── Stage 1: Frontend Build ───────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Backend + Serve ──────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps — skip heavy AI/ML packages for production web server
COPY backend/requirements.txt ./requirements.txt
RUN grep -v '^torch\|^trimesh\|^scipy\|^scikit-learn\|^vedo' requirements.txt > requirements-prod.txt && \
    pip install --no-cache-dir -r requirements-prod.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend to serve as static files
COPY --from=frontend-build /app/frontend/dist ./static

# Create data directory for SQLite
RUN mkdir -p /data

# Environment defaults (override via docker .env)
ENV DATABASE_URL="sqlite+aiosqlite:///./data/dentaflow.db"
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:8000/api/v1/auth/health || exit 1

EXPOSE 8000

# Start with uvicorn
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
