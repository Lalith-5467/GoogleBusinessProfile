# Production Deployment Guide

## Overview

In production, the application consists of:
1. **Frontend Static Assets**: Built via Vite (`npm run build`), served via Nginx, Apache, Caddy, or a CDN (Cloudflare Pages, Vercel, S3).
2. **FastAPI Backend**: Served via Gunicorn or Uvicorn behind a reverse proxy.
3. **MySQL Database**: Managed MySQL instance with backups and UTF-8 collation.

---

## 1. Frontend Production Build

From `frontend/`:
```bash
npm run build
```
This generates the optimized production bundle inside `frontend/dist/`.

### Nginx Example Configuration
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
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 2. Backend Production Deployment

Run with multiple Uvicorn workers or Gunicorn:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Systemd Service Example (`/etc/systemd/system/google-backend.service`)
```ini
[Unit]
Description=Google Business Profile Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/google-business-profile/backend
ExecStart=/var/www/google-business-profile/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```
