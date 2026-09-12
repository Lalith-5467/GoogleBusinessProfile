"""
Backend Server Launcher Script
Entry point for running the FastAPI application.
"""
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn
from app.config import settings

if __name__ == "__main__":
    loop_setting = "asyncio:ProactorEventLoop" if sys.platform == "win32" else "asyncio"
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        loop=loop_setting
    )
