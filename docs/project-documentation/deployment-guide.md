# Production Deployment Guide

## Overview

In production, the application consists of:
1. **Frontend Static Assets**: Built via Vite (`npm run build`), served via Nginx, Caddy, or a CDN/PaaS (Cloudflare Pages, Vercel, S3).
2. **FastAPI Backend**: Python service running Uvicorn behind a reverse proxy.
3. **Playwright Chromium Engine**: Headless browser binaries installed in the backend host/container environment for web scraping and business search.
4. **MySQL Database**: Managed MySQL 8.0 instance with UTF-8 (`utf8mb4_unicode_ci`) collation.

---

## 1. Playwright Chromium Browser Installation (CRITICAL)

On Linux servers, running `pip install -r requirements.txt` only installs the Python library. You **MUST** install the browser binaries and required OS shared libraries during the deployment build process:

```bash
# In the backend environment:
python -m playwright install --with-deps chromium
```

> [!IMPORTANT]
> If using Ubuntu/Debian, `--with-deps` automatically installs the necessary Linux GUI libraries (`libnss3`, `libatk`, `libcups2`, etc.) required by headless Chromium.
> If running without root/sudo privileges (e.g. standard user):
> ```bash
> python -m playwright install chromium
> ```

---

## 2. Google OAuth & Google Cloud Console Setup

To enable official Google Business Profile synchronization:

### 1. Enable Required APIs in Google Cloud Console
Navigate to **APIs & Services > Library** and enable:
- **My Business Account Management API** (`mybusinessaccountmanagement.googleapis.com`)
- **My Business Business Information API** (`mybusinessbusinessinformation.googleapis.com`)
- **Google People API** or **OAuth2 API**

### 2. OAuth Consent Screen
- Go to **APIs & Services > OAuth consent screen**.
- User Type: **External** (or Internal for Google Workspace).
- Add scopes: `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/business.manage`.

### 3. Create OAuth 2.0 Client ID
- Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
- Application type: **Web application**.
- **Authorized JavaScript origins**:
  - `https://yourdomain.com` (your production frontend origin)
  - `http://localhost:3000` (for development)
- **Authorized redirect URIs**:
  - `https://yourdomain.com/api/google-business/auth/callback` (production backend callback)
  - `http://localhost:8000/api/google-business/auth/callback` (for development)

---

## 3. Environment Variables Specification

Set the following variables in production (via systemd environment, Docker ENV, or platform dashboard):

| Variable | Scope | Required | Example Production Value |
|---|---|---|---|
| `ENVIRONMENT` | Backend | Yes | `production` |
| `PORT` | Backend | Yes | `8000` |
| `DATABASE_URL` | Backend | Yes | `mysql+pymysql://dbuser:password@prod-db.internal:3306/googlebusinessprofile` |
| `FRONTEND_URL` | Backend | Yes | `https://yourdomain.com` |
| `CORS_ORIGINS` | Backend | Optional | `https://yourdomain.com,https://app.yourdomain.com` |
| `GOOGLE_CLIENT_ID` | Backend | For OAuth | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Backend | For OAuth | `GOCSPX-secret_token` (keep secret!) |
| `GOOGLE_REDIRECT_URI` | Backend | For OAuth | `https://yourdomain.com/api/google-business/auth/callback` |
| `VITE_API_URL` | Frontend | Only if split | `https://api.yourdomain.com` (leave blank if reverse proxied) |

---

## 4. Linux Server Deployment (Ubuntu / Debian VPS)

### Automated Setup Script
Run the provided automated script:
```bash
bash scripts/setup-production.sh
```

### Manual Step-by-Step

1. **Clone repository**:
   ```bash
   git clone https://github.com/your-org/google-business-profile.git /var/www/google-business-profile
   cd /var/www/google-business-profile
   ```

2. **Frontend Build**:
   ```bash
   cd frontend
   npm ci
   npm run build
   # Output created at frontend/dist/
   ```

3. **Backend Setup & Playwright**:
   ```bash
   cd ../backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   python -m playwright install --with-deps chromium
   ```

4. **Configure Production Environment**:
   ```bash
   cp .env.example .env
   nano .env
   # Enter production DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FRONTEND_URL, GOOGLE_REDIRECT_URI
   ```

5. **Systemd Service (`/etc/systemd/system/google-backend.service`)**:
   ```ini
   [Unit]
   Description=Google Business Profile Backend API
   After=network.target

   [Service]
   User=www-data
   Group=www-data
   WorkingDirectory=/var/www/google-business-profile/backend
   EnvironmentFile=/var/www/google-business-profile/backend/.env
   ExecStart=/var/www/google-business-profile/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
   Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable google-backend
   sudo systemctl start google-backend
   ```

6. **Nginx Reverse Proxy Configuration (`/etc/nginx/sites-available/google-business.conf`)**:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       root /var/www/google-business-profile/frontend/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api/ {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_read_timeout 120s;
           proxy_connect_timeout 60s;
       }
   }
   ```
   Enable and reload Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/google-business.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

---

## 5. Docker Deployment

A production-ready `Dockerfile` and `docker-compose.yml` are included.

### Start with Docker Compose:
```bash
docker compose up -d --build
```
This launches:
- `mysql`: MySQL 8.0 database with persistent volume.
- `app`: FastAPI backend with Chromium pre-installed via the official Playwright Docker image and pre-built frontend static assets.

---

## 6. Production Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| `Executable doesn't exist at ~/.cache/ms-playwright/...` | Chromium browser was not installed | Run `python -m playwright install --with-deps chromium` |
| `Google OAuth credentials are not configured` | Missing `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` | Add credentials to production environment variables and restart backend |
| `redirect_uri_mismatch` on OAuth | `GOOGLE_REDIRECT_URI` does not match Cloud Console | Ensure `GOOGLE_REDIRECT_URI` matches the Authorized redirect URI in Google Cloud Console exactly |
| Database connection error | SQLAlchemy cannot connect | Verify `DATABASE_URL` format is `mysql+pymysql://user:pass@host:port/dbname` and MySQL server allows remote connections |
