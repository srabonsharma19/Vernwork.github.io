from datetime import datetime, timezone
from pathlib import Path
import os
import re
import secrets

import bcrypt
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import func, inspect, or_, text
from sqlalchemy.orm import Session
from typing import Literal

from app.database import engine, Base, get_db
from app.models.job import Job
from app.models.user import User
from app.crud.user import get_user_by_email, create_user

Base.metadata.create_all(bind=engine)
if engine.dialect.name == "sqlite":
    existing_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    with engine.begin() as connection:
        for column_name, column_type in (
            ("google_sub", "VARCHAR(255)"),
            ("full_name", "VARCHAR(120)"),
            ("avatar_url", "VARCHAR(500)"),
        ):
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)"))

app = FastAPI(title="Vernwork API")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

backend_dir = Path(__file__).resolve().parents[1]
pin_hash = os.getenv("APP_ACCESS_PIN_HASH", "").strip()
pin_hash_file = backend_dir / ".access-pin-hash"
if not pin_hash and pin_hash_file.exists():
    pin_hash = pin_hash_file.read_text(encoding="utf-8").strip()

session_secret = os.getenv("SESSION_SECRET") or secrets.token_urlsafe(48)
cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
if os.getenv("VERNWORK_ENV", "development").lower() == "production":
    if not os.getenv("SESSION_SECRET"):
        raise RuntimeError("SESSION_SECRET must be configured for production")
    if not pin_hash:
        raise RuntimeError("APP_ACCESS_PIN_HASH must be configured for production")
    if not cookie_secure:
        raise RuntimeError("COOKIE_SECURE must be true in production")
session_serializer = URLSafeTimedSerializer(session_secret, salt="vernwork-session-v1")
session_cookie = "vernwork_session"
session_max_age = 60 * 60 * 24 * 7
google_client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()


def read_session(token: str | None) -> dict:
    if not token:
        return {}
    try:
        claims = session_serializer.loads(token, max_age=session_max_age)
        return claims if isinstance(claims, dict) and claims.get("access") else {}
    except (BadSignature, SignatureExpired):
        return {}


def set_session_cookie(response: Response, user_id: int | None = None) -> None:
    claims = {"access": True, "user_id": user_id}
    response.set_cookie(
        session_cookie,
        session_serializer.dumps(claims),
        max_age=session_max_age,
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        path="/",
    )


def require_user_id(request: Request) -> int:
    user_id = getattr(request.state, "session", {}).get("user_id")
    if not isinstance(user_id, int):
        raise HTTPException(status_code=401, detail="Sign in to continue")
    return user_id

# -----------------------------------------
# CORS CONFIGURATION FOR ANGULAR FRONTEND
# -----------------------------------------
allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:4200,http://localhost:51786,http://127.0.0.1:4200,http://127.0.0.1:51786",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_app_access(request: Request, call_next):
    if request.method != "OPTIONS" and request.url.path.startswith("/api/") and request.url.path not in {
        "/api/access/status",
        "/api/access/unlock",
    }:
        claims = read_session(request.cookies.get(session_cookie))
        if not claims:
            return Response(status_code=401, content='{"detail":"Enter the access PIN first"}', media_type="application/json")
        request.state.session = claims
    return await call_next(request)

@app.get("/")
async def root():
    return {"message": "Vernwork Auth API Running"}

class AccessPinRequest(BaseModel):
    pin: str = Field(min_length=1, max_length=128)


class RegistrationRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    username: str = Field(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=10, max_length=72)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class LoginRequest(BaseModel):
    identity: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=72)

    @field_validator("identity")
    @classmethod
    def normalize_identity(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class GoogleTokenRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=8192)


class SetPasswordRequest(BaseModel):
    current_password: str | None = Field(default=None, max_length=72)
    new_password: str = Field(min_length=10, max_length=72)

    @field_validator("current_password")
    @classmethod
    def validate_current_password_bytes(cls, value: str | None) -> str | None:
        if value is not None and len(value.encode("utf-8")) > 72:
            raise ValueError("Current password must be at most 72 UTF-8 bytes")
        return value

    @field_validator("new_password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value

class ProfileUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_.-]+$")
    full_name: str | None = Field(default=None, max_length=120)
    country: str | None = None
    location: str | None = Field(default=None, max_length=160)
    student_status: str | None = None
    experience_level: str | None = None
    schedule_preference: str | None = None
    social_platform: str | None = None
    program_type: str | None = None
    availability: str | None = None


class JobCreateRequest(BaseModel):
    title: str = Field(min_length=8, max_length=180)
    category: Literal["Development", "Design", "Writing", "Marketing"]
    description: str = Field(min_length=30, max_length=10000)
    budget: float = Field(gt=0, le=100000000)

@app.get("/api/access/status")
def access_status(request: Request):
    session = read_session(request.cookies.get(session_cookie))
    return {
        "pin_required": bool(pin_hash),
        "unlocked": bool(session),
        "authenticated": isinstance(session.get("user_id"), int),
    }


@app.post("/api/access/unlock")
@limiter.limit("5/minute")
def unlock_app(request: Request, data: AccessPinRequest, response: Response):
    if not pin_hash:
        raise HTTPException(status_code=503, detail="App access PIN is not configured on the server")
    try:
        valid_pin = bcrypt.checkpw(data.pin.encode("utf-8"), pin_hash.encode("utf-8"))
    except ValueError:
        valid_pin = False
    if not valid_pin:
        raise HTTPException(status_code=401, detail="That access PIN is not correct")
    set_session_cookie(response)
    return {"message": "App unlocked"}


@app.post("/api/auth/register")
@limiter.limit("5/minute")
def register(request: Request, data: RegistrationRequest, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=409, detail="That username is already taken")

    password_hash = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")
    user = create_user(db, data.email, data.username, "password", password_hash)
    set_session_cookie(response, user.id)
    return {"id": user.id, "username": user.username}


@app.post("/api/auth/login")
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        or_(User.email == data.identity, func.lower(User.username) == data.identity)
    ).first()
    valid = bool(user and user.password_hash and bcrypt.checkpw(data.password.encode("utf-8"), user.password_hash.encode("ascii")))
    if not valid:
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    set_session_cookie(response, user.id)
    return {"id": user.id, "username": user.username}


@app.post("/api/auth/google")
@limiter.limit("10/minute")
def google_login(request: Request, data: GoogleTokenRequest, response: Response, db: Session = Depends(get_db)):
    if not google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on the server")
    try:
        claims = id_token.verify_oauth2_token(data.credential, google_requests.Request(), google_client_id)
    except Exception as error:
        raise HTTPException(status_code=401, detail="Google could not verify this sign-in") from error
    email = str(claims.get("email", "")).strip().lower()
    google_sub = str(claims.get("sub", "")).strip()
    if not email or claims.get("email_verified") is not True:
        raise HTTPException(status_code=401, detail="Google account email is not verified")
    if not google_sub:
        raise HTTPException(status_code=401, detail="Google account identity is missing")
    user = db.query(User).filter(User.google_sub == google_sub).first()
    if user is not None and user.email != email:
        raise HTTPException(status_code=409, detail="This Google account is already linked to another email")
    if user is None:
        user = get_user_by_email(db, email)
    if user is None:
        base_name = re.sub(r"[^a-zA-Z0-9_.-]", "", email.split("@", 1)[0])[:32] or "member"
        username = base_name
        suffix = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base_name[:34]}{suffix}"
            suffix += 1
        user = create_user(db, email, username, "google")
    if user.google_sub and user.google_sub != google_sub:
        raise HTTPException(status_code=409, detail="A different Google account is already linked to this email")
    user.google_sub = google_sub
    google_name = claims.get("name")
    if isinstance(google_name, str) and google_name.strip() and not user.full_name:
        user.full_name = google_name.strip()[:120]
    google_avatar = claims.get("picture")
    if isinstance(google_avatar, str) and google_avatar.startswith("https://"):
        user.avatar_url = google_avatar[:500]
    db.commit()
    set_session_cookie(response, user.id)
    return {"id": user.id, "username": user.username}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    response.delete_cookie(session_cookie, path="/")
    return {"message": "Signed out"}


def user_profile(user: User, include_email: bool = False) -> dict:
    profile = {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "provider": (
            "Google + password" if user.google_sub and user.password_hash
            else "Google" if user.google_sub
            else "Email and password" if user.password_hash
            else "Vernwork"
        ),
        "created_at": user.created_at,
        "country": user.country,
        "location": user.location,
        "student_status": user.student_status,
        "experience_level": user.experience_level,
        "schedule_preference": user.schedule_preference,
        "social_platform": user.social_platform,
        "program_type": user.program_type,
        "availability": user.availability,
    }
    if include_email:
        profile["email"] = user.email
        profile["has_password"] = bool(user.password_hash)
        profile["google_linked"] = bool(user.google_sub)
    return profile


@app.get("/api/users/me")
def get_current_user(request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == require_user_id(request)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user_profile(user, include_email=True)


@app.put("/api/users/me")
def update_current_user(data: ProfileUpdate, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == require_user_id(request)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    updates = data.model_dump(exclude_unset=True)
    if "username" in updates and updates["username"] is None:
        raise HTTPException(status_code=422, detail="Username cannot be empty")
    if "username" in updates and db.query(User).filter(User.username == updates["username"], User.id != user.id).first():
        raise HTTPException(status_code=409, detail="That username is already taken")
    for key, value in updates.items():
        setattr(user, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(user)
    return user_profile(user, include_email=True)


@app.put("/api/users/me/password")
@limiter.limit("5/hour")
def set_current_password(request: Request, data: SetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == require_user_id(request)).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.password_hash:
        if not data.current_password or not bcrypt.checkpw(
            data.current_password.encode("utf-8"), user.password_hash.encode("ascii")
        ):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
    user.password_hash = bcrypt.hashpw(data.new_password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")
    db.commit()
    return {"message": "Password saved. You can now sign in with your username and password."}


def job_response(job: Job, owner: User) -> dict:
    client_name = owner.full_name or owner.username
    initials = "".join(part[0] for part in client_name.split()[:2]).upper() or "V"
    return {
        "id": job.id,
        "title": job.title,
        "client": client_name,
        "initials": initials,
        "client_id": owner.id,
        "client_avatar_url": owner.avatar_url,
        "category": job.category,
        "description": job.description,
        "budget": float(job.budget),
        "budgetType": job.budget_type,
        "skills": [job.category],
        "posted": job.created_at.isoformat() if job.created_at else "Just now",
        "proposals": 0,
    }


@app.get("/api/jobs")
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc(), Job.id.desc()).all()
    owner_ids = {job.owner_id for job in jobs}
    owners = {user.id: user for user in db.query(User).filter(User.id.in_(owner_ids)).all()} if owner_ids else {}
    return [job_response(job, owners[job.owner_id]) for job in jobs if job.owner_id in owners]


@app.post("/api/jobs", status_code=201)
@limiter.limit("10/hour")
def create_job(request: Request, data: JobCreateRequest, db: Session = Depends(get_db)):
    owner = db.query(User).filter(User.id == require_user_id(request)).first()
    if owner is None:
        raise HTTPException(status_code=404, detail="Account not found")
    job = Job(
        owner_id=owner.id,
        title=data.title.strip(),
        category=data.category,
        description=data.description.strip(),
        budget=data.budget,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job_response(job, owner)


@app.get("/api/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_profile(user)

