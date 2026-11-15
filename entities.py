from sqlalchemy import String, Float, Integer, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from app.database.connection import Base

class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reference: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    customer: Mapped[str] = mapped_column(String(100))
    amount: Mapped[float] = mapped_column(Float)
    product: Mapped[str] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(80))
    new_address: Mapped[bool] = mapped_column(Boolean, default=False)
    device_id: Mapped[str] = mapped_column(String(80))
    attempts_10m: Mapped[int] = mapped_column(Integer, default=1)
    account_age_days: Mapped[int] = mapped_column(Integer, default=365)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    decision: Mapped[str] = mapped_column(String(20), default="APPROVE")
    status: Mapped[str] = mapped_column(String(30), default="AUTHORIZED")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

class FraudAlert(Base):
    __tablename__ = "fraud_alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    severity: Mapped[str] = mapped_column(String(20))
    category: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="OPEN")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

class Chargeback(Base):
    __tablename__ = "chargebacks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_ref: Mapped[str] = mapped_column(String(40), unique=True)
    transaction_ref: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str] = mapped_column(String(100))
    amount: Mapped[float] = mapped_column(Float)
    due_date: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="NEEDS_EVIDENCE")
