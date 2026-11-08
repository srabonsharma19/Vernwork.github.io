from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects import mysql

from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(
        Integer().with_variant(mysql.INTEGER(unsigned=True), "mysql"),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(180), nullable=False)
    category = Column(String(40), nullable=False)
    description = Column(Text, nullable=False)
    budget = Column(Numeric(12, 2), nullable=False)
    budget_type = Column(String(20), nullable=False, default="Fixed price")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)