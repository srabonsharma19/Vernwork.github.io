from sqlalchemy.orm import Session
from app.models.user import User

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, email: str, provider: str):
    username = email.split("@")[0]

    new_user = User(
        email=email,
        username=username,
        provider=provider
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def update_onboarding(
    db: Session,
    user_id: int,
    country: str = None,
    student_status: str = None,
    experience_level: str = None,
    schedule_preference: str = None,
    social_platform: str = None,
    program_type: str = None,
    availability: str = None
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        return None

    user.country = country
    user.student_status = student_status
    user.experience_level = experience_level
    user.schedule_preference = schedule_preference
    user.social_platform = social_platform
    user.program_type = program_type
    user.availability = availability

    db.commit()
    db.refresh(user)
    return user
