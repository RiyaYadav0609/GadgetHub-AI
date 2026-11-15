FEATURES = [
    "amount", "new_address", "attempts_10m", "account_age_days",
    "device_age_days", "ip_velocity_1h", "failed_logins_24h",
    "shipping_billing_mismatch", "email_age_days", "prior_chargebacks",
    "device_shared_accounts", "country_mismatch", "card_bin_velocity",
]

FEATURE_LABELS = {
    "amount": "Transaction amount",
    "new_address": "New delivery address",
    "attempts_10m": "Attempts in 10 minutes",
    "account_age_days": "Account age (days)",
    "device_age_days": "Device age (days)",
    "ip_velocity_1h": "IP transactions in 1 hour",
    "failed_logins_24h": "Failed logins in 24 hours",
    "shipping_billing_mismatch": "Shipping/billing mismatch",
    "email_age_days": "Email age (days)",
    "prior_chargebacks": "Prior chargebacks",
    "device_shared_accounts": "Accounts sharing device",
    "country_mismatch": "Country mismatch",
    "card_bin_velocity": "Card BIN attempts in 1 hour",
}
