
from pydantic import BaseModel, Field


class ScoreRequest(BaseModel):
    customer: str = Field(default="Guest Customer", min_length=1, max_length=100)
    product: str = Field(default="Electronics", min_length=1, max_length=100)
    city: str = Field(default="Unknown", min_length=1, max_length=80)

    amount: float = Field(gt=0, le=10000000)
    new_address: bool = False
    attempts_10m: int = Field(default=1, ge=1, le=10000)
    account_age_days: int = Field(default=365, ge=0, le=100000)
    device_id: str = Field(default="device-unknown", max_length=80)

    device_age_days: int = Field(default=180, ge=0, le=100000)
    ip_velocity_1h: int = Field(default=1, ge=0, le=100000)
    failed_logins_24h: int = Field(default=0, ge=0, le=100000)
    shipping_billing_mismatch: bool = False
    email_age_days: int = Field(default=365, ge=0, le=100000)
    prior_chargebacks: int = Field(default=0, ge=0, le=10000)
    device_shared_accounts: int = Field(default=1, ge=1, le=100000)
    country_mismatch: bool = False
    card_bin_velocity: int = Field(default=1, ge=0, le=100000)
