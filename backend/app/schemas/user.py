from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: str
    username: str
    provider: str
    country: Optional[str] = None
    student_status: Optional[str] = None
    experience_level: Optional[str] = None
    schedule_preference: Optional[str] = None
    social_platform: Optional[str] = None
    program_type: Optional[str] = None
    availability: Optional[str] = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
