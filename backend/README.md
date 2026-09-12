# Google Business Profile Management & Playwright Web Scraper (FastAPI + Python)

This project contains two isolated, high-performance Python FastAPI backend modules connected to Laragon MySQL (`googlebusinessprofile` database):

1. **Google Business Profile API Module**: Synchronizes official locations via Google OAuth 2.0 (`/api/google-business/*`).
2. **Playwright Website Business Scraper Module**: Extracts public company website profiles using Playwright Chromium (`/api/scraper/*`).

---

## 🚀 Features

- **Playwright Website Scraper**: Async Chromium browser extraction of public company website data.
- **Structured Metadata Parsing**: Schema.org / JSON-LD, Open Graph, meta tags, semantic HTML (`tel:`, `mailto:`, `<address>`).
- **Google OAuth 2.0 & Official API Sync**: Official Google Business Profile location management.
- **MySQL Data Persistence**: Isolated tables (`google_business_locations` and `scraped_businesses`).
- **Prominent Total Businesses Count**: Sourced dynamically from MySQL queries.
- **RFC-4180 CSV Exports**: Separate downloadable CSV reports (`google_businesses.csv` & `scraped_businesses.csv`).
- **Zero Mock / Fake Fallback Policy**: Real database and API responses with clear error handling.

---

## ⚙️ Environment Setup

### 1. Requirements
- Python 3.10+ (Tested with Python 3.13)
- MySQL / Laragon (Database: `googlebusinessprofile`)

### 2. Installation

Navigate into the backend directory and install dependencies:

```bash
cd google-business-backend
python -m pip install -r requirements.txt
```

### 3. Install Playwright Chromium Browser

Install Playwright's headless Chromium browser engine:

```bash
python -m playwright install chromium
```

### 4. Configuration (`.env`)

Copy `.env.example` to `.env` and fill in your configuration:

```env
PORT=8000
DATABASE_URL=mysql+pymysql://root:@localhost:3306/googlebusinessprofile
FRONTEND_URL=http://localhost:3000

# Google OAuth 2.0 Credentials (For Google Business Profile Module)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/google-business/auth/callback
```

---

## 🏃 Running the Backend Server

Start the FastAPI backend on port **8000**:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

- Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Swagger OpenAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📡 API Endpoints Summary

### Web Scraper Endpoints (`/api/scraper/*`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/scraper/company` | Scrapes single public website URL using Playwright & saves to MySQL |
| `POST` | `/api/scraper/bulk` | Bulk scrapes multiple website URLs with controlled concurrency |
| `GET` | `/api/scraper/businesses` | Lists stored `scraped_businesses` from MySQL |
| `GET` | `/api/scraper/count` | Returns total count of scraped businesses |
| `DELETE` | `/api/scraper/businesses/{id}` | Deletes record from `scraped_businesses` in MySQL |
| `GET` | `/api/scraper/export` | Downloads `scraped_businesses.csv` file |

### Google Business Profile Endpoints (`/api/google-business/*`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/google-business/status` | Google OAuth status and location count |
| `GET` | `/api/google-business/auth/url` | Generates Google OAuth consent URL |
| `POST` | `/api/google-business/sync` | Syncs locations from official Google API into MySQL |
| `GET` | `/api/google-business/locations` | Lists stored location records from MySQL |
| `GET` | `/api/google-business/count` | Returns total location count |
| `GET` | `/api/google-business/export` | Downloads `google_businesses.csv` file |

---

## 🔒 Security & Responsible Scraping

- **SSRF Protection**: Backend validates all URLs and blocks local/internal hostnames (`localhost`, `127.0.0.1`, private IP ranges, cloud metadata).
- **Public Data Only**: Scrapes only publicly accessible HTML metadata; no CAPTCHA/anti-bot bypass or credential harvesting.
- **Duplicate Prevention**: Handles duplicates based on `source_url`.
- **OAuth Isolation**: Web scraper does NOT require Google OAuth or Google account connection.
