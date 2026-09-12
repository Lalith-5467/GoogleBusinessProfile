# Google Business Profile & Website Scraper

A full-stack enterprise web application for managing official Google Business Profiles via Google OAuth 2.0 and extracting public business metadata via Playwright Chromium into MySQL.

---

## 📁 Clean Professional Project Structure

```
Google-Business-Profile/
│
├── frontend/                     # React 18 + TypeScript + Vite + Tailwind CSS
│   ├── public/                   # Static assets & favicons
│   │   └── favicon.svg
│   ├── src/
│   │   ├── assets/               # Brand assets & logos
│   │   ├── components/           # UI views & components
│   │   │   ├── GoogleBusinessView.tsx
│   │   │   └── WebsiteScraperView.tsx
│   │   ├── pages/                # Page route views
│   │   ├── layouts/              # App layouts & shells
│   │   ├── features/             # Feature-specific modules
│   │   ├── services/             # API client services
│   │   │   ├── googleBusinessApi.ts
│   │   │   └── scraperApi.ts
│   │   ├── hooks/                # Custom React hooks
│   │   ├── context/              # Global React context state
│   │   ├── routes/               # Route declarations
│   │   ├── utils/                # UI helpers & formatters
│   │   ├── constants/            # Application constants
│   │   ├── types/                # TypeScript interfaces & DTOs
│   │   │   ├── googleBusiness.types.ts
│   │   │   ├── scraper.types.ts
│   │   │   └── index.ts
│   │   ├── styles/               # Design system & Tailwind styling
│   │   │   └── index.css
│   │   ├── config/               # Frontend API endpoint configuration
│   │   │   └── api.config.ts
│   │   ├── App.tsx               # Root application view
│   │   └── main.tsx              # React DOM entry point
│   ├── package.json              # Frontend dependencies & scripts
│   ├── vite.config.ts            # Vite bundler & reverse proxy config
│   ├── tsconfig.json             # TypeScript compiler config
│   ├── tailwind.config.js        # Design system color & radius tokens
│   └── postcss.config.js         # PostCSS plugins
│
├── backend/                      # Python 3.10+ FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── config.py             # Environment & settings configuration
│   │   ├── database.py           # SQLAlchemy MySQL engine & session
│   │   ├── main.py               # FastAPI app definition & router mounting
│   │   ├── middleware/           # CORS & request pipeline middleware
│   │   ├── models/               # SQLAlchemy ORM database models
│   │   │   ├── business.py       # Google Business Account & Location models
│   │   │   └── scraped_business.py # Scraped Business model
│   │   ├── routes/               # API route controllers
│   │   │   ├── businesses.py     # Location management endpoints
│   │   │   ├── google_auth.py    # Google OAuth 2.0 endpoints
│   │   │   └── scraper.py        # Playwright scraper endpoints
│   │   ├── schemas/              # Pydantic request/response validators
│   │   │   ├── business.py
│   │   │   └── scraper.py
│   │   ├── services/             # Core business logic services
│   │   │   ├── google_business.py
│   │   │   ├── web_scraper.py
│   │   │   ├── csv_export.py
│   │   │   └── scraper_csv_export.py
│   │   ├── utils/                # URL & phone sanitization helpers
│   │   └── types/                # Python type aliases
│   ├── tests/                    # Backend unit & endpoint tests
│   ├── server.py                 # Standalone server launcher script
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example              # Backend environment template
│   └── README.md                 # Backend documentation
│
├── database/                     # Database architecture & schemas
│   ├── prisma/                   # Prisma schema for GUI & tooling
│   │   ├── schema.prisma
│   │   └── README.md
│   ├── scripts/                  # SQL scripts
│   │   ├── schema.sql            # Full MySQL DDL schema
│   │   └── seed.sql              # Development test fixtures
│   └── README.md                 # Database overview & instructions
│
├── docs/                         # Project Documentation
│   ├── design-system/            # Color palettes, typography & components
│   │   ├── color-palette.md
│   │   └── components.md
│   ├── api/                      # OpenAPI endpoint documentation
│   │   ├── google-business-api.md
│   │   └── scraper-api.md
│   └── project-documentation/    # System architecture & developer guides
│       ├── architecture.md
│       ├── getting-started.md
│       └── deployment-guide.md
│
├── scripts/                      # Developer automation batch scripts
│   ├── start-frontend.bat        # Start Vite dev server (:3000)
│   ├── start-backend.bat         # Start FastAPI server (:8000)
│   └── start-dev.bat             # Launch both servers concurrently
│
├── .env.example                  # Full-stack environment template
├── .gitignore                    # Monorepo gitignore
├── README.md                     # Root project guide
└── package.json                  # Root monorepo orchestrator
```

---

## ⚡ Quick Start

### 1. Database (MySQL / Laragon)
Ensure MySQL is running and create the database `googlebusinessprofile`:
```sql
CREATE DATABASE IF NOT EXISTS `googlebusinessprofile`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

### 2. Backend (FastAPI :8000)
```bash
cd backend
python -m venv .venv
# Activate virtual environment
pip install -r requirements.txt
python -m playwright install chromium
python server.py
```
- API Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Interactive Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Frontend (Vite React :3000)
```bash
cd frontend
npm install
npm run dev
```
- Web Application: [http://localhost:3000](http://localhost:3000)

### 4. Or Use One-Click Launcher
Double click `scripts/start-dev.bat` to launch both servers.

---

## 📚 Documentation Links

- [Design System Guide](docs/design-system/color-palette.md)
- [UI Components Specification](docs/design-system/components.md)
- [Google Business Profile API Reference](docs/api/google-business-api.md)
- [Website Scraper API Reference](docs/api/scraper-api.md)
- [System Architecture](docs/project-documentation/architecture.md)
- [Developer Onboarding](docs/project-documentation/getting-started.md)
- [Production Deployment](docs/project-documentation/deployment-guide.md)
- [Database Schema Guide](database/README.md)
