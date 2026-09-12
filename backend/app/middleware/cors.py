from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

def setup_cors(app: FastAPI) -> None:
    """Configure CORS origins and middleware for the FastAPI application."""
    origins = [
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
