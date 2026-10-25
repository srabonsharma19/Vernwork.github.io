from sqlalchemy import Column, Integer, String, TIMESTAMP
from sqlalchemy.dialects import mysql
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer().with_variant(mysql.INTEGER(unsigned=True), "mysql"), primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), nullable=False)
    provider = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=True)
    google_sub = Column(String(255), unique=True, nullable=True)
    full_name = Column(String(120), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(TIMESTAMP, nullable=False)

    # Additional profile fields
    country = Column(String(100), nullable=True)
    location = Column(String(160), nullable=True)
    student_status = Column(String(50), nullable=True)
    experience_level = Column(String(50), nullable=True)
    schedule_preference = Column(String(50), nullable=True)
    social_platform = Column(String(50), nullable=True)
    program_type = Column(String(100), nullable=True)
    availability = Column(String(50), nullable=True)
