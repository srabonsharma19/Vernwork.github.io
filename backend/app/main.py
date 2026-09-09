from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.database import engine, Base, get_db
from app.models.user import User
from app.crud.user import get_user_by_email, create_user

# -----------------------------------------
# DATABASE INITIALIZATION
# -----------------------------------------
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vernwork Auth System")

# -----------------------------------------
# CORS CONFIGURATION FOR ANGULAR FRONTEND
# -----------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Vernwork Auth API Running"}

# -----------------------------------------
# REQUEST MODELS
# -----------------------------------------
class ConnectRequest(BaseModel):
    email: str
    provider: str

class ProfileUpdate(BaseModel):
    id: int
    country: str | None = None
    student_status: str | None = None
    experience_level: str | None = None
    schedule_preference: str | None = None

# -----------------------------------------
# GOOGLE / APPLE LOGIN ENDPOINT
# -----------------------------------------
@app.post("/api/auth/connect")
def connect_user(data: ConnectRequest, db: Session = Depends(get_db)):
    email = data.email
    provider = data.provider

    # Only Gmail or Apple ID allowed
    if not (email.endswith("@gmail.com") or email.endswith("@icloud.com")):
        raise HTTPException(status_code=400, detail="Only Gmail or Apple ID allowed")

    # Check if user already exists
    existing = get_user_by_email(db, email)
    if existing:
        return {
            "message": "User already registered",
            "id": existing.id,
            "username": existing.username
        }

    # Create new user
    new_user = create_user(db, email, provider)
    new_user.created_at = datetime.utcnow()
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Account created",
        "id": new_user.id,
        "username": new_user.username
    }

# -----------------------------------------
# PROFILE UPDATE ENDPOINT
# -----------------------------------------
@app.post("/api/auth/update-profile")
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.country = data.country
    user.student_status = data.student_status
    user.experience_level = data.experience_level
    user.schedule_preference = data.schedule_preference
    db.commit()
    db.refresh(user)

    return {"message": "Profile updated successfully", "id": user.id}

@router.get("/user/{name}")
def get_user(name: str):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT * FROM users WHERE username = %s", (name,))
    result = cursor.fetchone()

    return result

