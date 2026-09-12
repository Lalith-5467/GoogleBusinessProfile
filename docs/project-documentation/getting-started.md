# Developer Getting Started Guide

## Prerequisites

- **Node.js**: v18.0 or later
- **Python**: v3.10 or later
- **MySQL Server**: Running on `localhost:3306` (e.g. via Laragon, XAMPP, or standalone MySQL)

---

## 1. Database Setup

Ensure the `googlebusinessprofile` database exists:

```sql
CREATE DATABASE IF NOT EXISTS `googlebusinessprofile`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

Optionally initialize tables using the provided script:

```bash
mysql -u root -p googlebusinessprofile < database/scripts/schema.sql
```

---

## 2. Backend Setup

1. Open a terminal in `backend/`:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment (recommended):
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Install Playwright browser engine:
   ```bash
   python -m playwright install chromium
   ```
5. Configure environment variables:
   Copy `.env.example` to `.env` and verify database credentials:
   ```env
   PORT=8000
   DATABASE_URL=mysql+pymysql://root:@localhost:3306/googlebusinessprofile
   FRONTEND_URL=http://localhost:3000
   ```
6. Start the backend:
   ```bash
   python server.py
   # Or using uvicorn directly:
   python -m uvicorn app.main:app --reload --port 8000
   ```

---

## 3. Frontend Setup

1. Open a terminal in `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies (if not already present):
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Access the web app in your browser at `http://localhost:3000`.

---

## 4. One-Click Convenience Scripts

You can also use the scripts in `scripts/`:
- `scripts/start-frontend.bat` - Starts Vite dev server.
- `scripts/start-backend.bat` - Starts FastAPI backend.
- `scripts/start-dev.bat` - Launches both services.
