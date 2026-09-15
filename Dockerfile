# ==============================================================================
# Stage 1: Build React Frontend
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Backend with Playwright Chromium
# ==============================================================================
FROM mcr.microsoft.com/playwright/python:v1.41.0-jammy AS production

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Ensure Chromium browser is downloaded and installed
RUN python -m playwright install --with-deps chromium

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend assets to static directory
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Default environment variables
ENV PORT=8000 \
    ENVIRONMENT=production \
    PYTHONUNBUFFERED=1

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
