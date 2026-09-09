from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), nullable=False)
    provider = Column(Enum("google", "apple"), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False)

    # Additional profile fields
    country = Column(String(100), nullable=True)
    student_status = Column(String(50), nullable=True)
    experience_level = Column(String(50), nullable=True)
    schedule_preference = Column(String(50), nullable=True)
    social_platform = Column(String(50), nullable=True)
    program_type = Column(String(100), nullable=True)
    availability = Column(String(50), nullable=True)
