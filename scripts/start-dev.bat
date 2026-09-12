@echo off
echo ===================================================
echo Starting Google Business Profile Full-Stack System
echo ===================================================

start "Backend Server (FastAPI :8000)" cmd /k "%~dp0start-backend.bat"
start "Frontend Server (Vite :3000)" cmd /k "%~dp0start-frontend.bat"

echo.
echo Both services launched in separate console windows.
echo - Backend API: http://localhost:8000/docs
echo - Frontend UI: http://localhost:3000
echo.
