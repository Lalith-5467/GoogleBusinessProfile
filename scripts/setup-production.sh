#!/usr/bin/env bash
# ==============================================================================
# Production Deployment & Setup Script for Linux Environments
# Supports: Ubuntu, Debian, CentOS, AlmaLinux, RockyLinux, AWS Linux
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== [1/5] Checking environment & dependencies ==="
cd "${ROOT_DIR}"

if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 is not installed or not in PATH."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "ERROR: node is not installed or not in PATH."
    exit 1
fi

echo "Python: $(python3 --version)"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"

echo ""
echo "=== [2/5] Setting up Backend Python Virtual Environment ==="
cd "${ROOT_DIR}/backend"
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment at backend/.venv..."
    python3 -m venv .venv
fi

source .venv/bin/activate
echo "Upgrading pip and installing backend requirements..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "=== [3/5] Installing Playwright Chromium & OS Dependencies ==="
# Playwright chromium installation with system libraries
echo "Installing Playwright Chromium browser and Linux system libraries..."
python -m playwright install --with-deps chromium || {
    echo "WARNING: '--with-deps' requires sudo permissions. Attempting standard chromium installation..."
    python -m playwright install chromium
}

echo ""
echo "=== [4/5] Building Frontend Static Assets ==="
cd "${ROOT_DIR}/frontend"
echo "Installing frontend npm packages..."
npm ci || npm install
echo "Building production frontend bundle..."
npm run build

echo ""
echo "=== [5/5] Deployment Validation ==="
cd "${ROOT_DIR}"
echo "Checking frontend dist bundle..."
if [ -f "frontend/dist/index.html" ]; then
    echo "Frontend built successfully -> frontend/dist/"
else
    echo "ERROR: frontend/dist/index.html was not generated."
    exit 1
fi

echo ""
echo "================================================================================"
echo "Production Setup Complete!"
echo "To start the FastAPI backend service:"
echo "  cd ${ROOT_DIR}/backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port \${PORT:-8000} --workers 4"
echo "Serve the frontend statically via Nginx from:"
echo "  ${ROOT_DIR}/frontend/dist"
echo "================================================================================"
