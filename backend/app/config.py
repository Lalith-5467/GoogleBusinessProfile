import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8000
    DATABASE_URL: str = "mysql+pymysql://root:@127.0.0.1:3306/googlebusinessprofile"
    FRONTEND_URL: str = "http://localhost:3000"
    
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/google-business/auth/callback"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
