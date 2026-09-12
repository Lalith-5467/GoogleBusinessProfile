# System Architecture & Technical Overview

## High-Level Architecture Diagram

```
[ Web Browser ]
      │
      │ (HTTP / React UI : Port 3000)
      ▼
[ Frontend (React + TypeScript + Vite + Tailwind) ]
      │
      │ (API Requests / Proxy)
      ▼
[ Backend (Python FastAPI : Port 8000) ]
 ├── Google OAuth & API Service ───▶ [ Google Business Profile Official API ]
 ├── Playwright Web Scraper Engine ─▶ [ Chromium Headless Browser ]
 └── SQLAlchemy ORM ───────────────▶ [ MySQL Database (googlebusinessprofile) ]
```

## Core Modules

### 1. Frontend Architecture (`frontend/`)
- **Technology**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Directory Layout**:
  - `src/components/`: Primary interactive views (`GoogleBusinessView`, `WebsiteScraperView`).
  - `src/services/`: API client abstractions (`googleBusinessApi.ts`, `scraperApi.ts`).
  - `src/types/`: TypeScript interfaces and data transfer objects.
  - `src/config/`: Centralized API routing constants.
  - `src/styles/`: Design system tokens and global styles.

### 2. Backend Architecture (`backend/`)
- **Technology**: Python 3.10+, FastAPI, SQLAlchemy 2.0, Playwright, PyMySQL, Pydantic v2.
- **Directory Layout**:
  - `app/routes/`: FastAPI API routers.
  - `app/services/`: Core business logic (Playwright scraper engine, Google OAuth, CSV generation).
  - `app/models/`: SQLAlchemy ORM database models.
  - `app/schemas/`: Pydantic request and response schemas.
  - `app/middleware/`: CORS and request pipeline middleware.
  - `app/utils/`: Common sanitization and helper routines.

### 3. Database Layer (`database/`)
- **Technology**: MySQL 8.0+ / MariaDB (Laragon / Docker / Local).
- **Scripts**: `database/scripts/schema.sql` and `database/scripts/seed.sql`.
- **Introspection**: `database/prisma/schema.prisma` for schema visualizers and multi-language tooling.
