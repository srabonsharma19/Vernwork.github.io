from datetime import datetime, timezone

from sqlalchemy.orm import Session
from app.models.user import User

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, email: str, username: str, provider: str, password_hash: str | None = None):
    new_user = User(
        email=email,
        username=username.strip(),
        provider=provider,
        password_hash=password_hash,
        created_at=datetime.now(timezone.utc),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
