@echo off
echo Starting Google Business Profile FastAPI Backend...
cd /d "%~dp0..\backend"

set "PYTHON_EXE=python"
if exist "E:\laragon\bin\python\python-3.13\python.exe" (
    set "PYTHON_EXE=E:\laragon\bin\python\python-3.13\python.exe"
) else if exist "C:\laragon\bin\python\python-3.13\python.exe" (
    set "PYTHON_EXE=C:\laragon\bin\python\python-3.13\python.exe"
) else if exist "%~dp0..\backend\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0..\backend\.venv\Scripts\python.exe"
) else if exist "%~dp0..\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0..\.venv\Scripts\python.exe"
)

"%PYTHON_EXE%" server.py
