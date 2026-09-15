from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

def setup_cors(app: FastAPI) -> None:
    """Configure CORS origins and middleware for the FastAPI application."""
    origins = settings.get_cors_origins()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
