from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

configured_database_url = os.getenv("DATABASE_URL")
if os.getenv("VERNWORK_ENV", "development").lower() == "production" and not configured_database_url:
    raise RuntimeError("DATABASE_URL must be configured for production; refusing to start on SQLite")

DATABASE_URL = configured_database_url or f"sqlite:///{(Path(__file__).resolve().parents[1] / 'vernwork.db').as_posix()}"

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
else:
    engine_options.update({"pool_size": 10, "max_overflow": 20})

engine = create_engine(DATABASE_URL, **engine_options)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()