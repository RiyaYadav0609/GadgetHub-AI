"""Generate a reproducible, clearly-labelled synthetic GadgetHub transaction dataset.
This is for engineering demonstration only, not a substitute for labelled merchant data.
"""
from pathlib import Path
import argparse
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "data" / "gadgethub_synthetic_transactions.csv"


def generate_dataset(n_rows: int = 12000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    amount = np.clip(rng.lognormal(np.log(18000), 0.72, n_rows), 500, 250000).round(2)
    new_address = rng.binomial(1, 0.24, n_rows)
    attempts_10m = np.clip(rng.poisson(1.5, n_rows) + 1, 1, 35)
    account_age_days = np.clip(rng.exponential(260, n_rows).astype(int), 0, 2500)
    device_age_days = np.clip(rng.exponential(180, n_rows).astype(int), 0, 2000)
    ip_velocity_1h = np.clip(rng.poisson(2.2, n_rows), 0, 45)
    failed_logins_24h = np.clip(rng.poisson(0.45, n_rows), 0, 20)
    shipping_billing_mismatch = rng.binomial(1, 0.075, n_rows)
    email_age_days = np.clip(rng.exponential(420, n_rows).astype(int), 0, 3000)
    prior_chargebacks = np.clip(rng.poisson(0.06, n_rows), 0, 5)
    device_shared_accounts = np.clip(rng.poisson(1.15, n_rows) + 1, 1, 25)
    country_mismatch = rng.binomial(1, 0.025, n_rows)
    card_bin_velocity = np.clip(rng.poisson(1.1, n_rows), 0, 60)

    # Simulate several overlapping fraud archetypes instead of a single clean rule.
    card_testing = (attempts_10m >= 7) & (card_bin_velocity >= 6)
    account_takeover = ((account_age_days < 14) | (device_age_days < 5)) & (failed_logins_24h >= 2)
    friendly_fraud_or_abuse = (prior_chargebacks >= 1) | (device_shared_accounts >= 5)
    suspicious_checkout = (shipping_billing_mismatch == 1) & (new_address == 1) & (amount >= 20000)
    z = (-4.7
         + 1.15 * new_address
         + 0.20 * np.maximum(attempts_10m - 2, 0)
         + 1.25 * (account_age_days < 7)
         + 1.05 * (device_age_days < 3)
         + 0.16 * ip_velocity_1h
         + 0.28 * failed_logins_24h
         + 1.25 * shipping_billing_mismatch
         + 0.85 * (email_age_days < 3)
         + 1.55 * prior_chargebacks
         + 0.22 * np.maximum(device_shared_accounts - 2, 0)
         + 1.35 * country_mismatch
         + 0.16 * np.maximum(card_bin_velocity - 3, 0)
         + 0.000012 * amount
         + 1.5 * card_testing
         + 1.25 * account_takeover
         + 0.75 * friendly_fraud_or_abuse
         + 1.1 * suspicious_checkout
         + rng.normal(0, 0.48, n_rows))
    p = 1 / (1 + np.exp(-z))
    p = np.clip(p, 0.001, 0.92)
    is_fraud = rng.binomial(1, p)

    df = pd.DataFrame({
        "transaction_id": [f"GH-SYN-{i:07d}" for i in range(1, n_rows + 1)],
        "amount": amount,
        "new_address": new_address,
        "attempts_10m": attempts_10m,
        "account_age_days": account_age_days,
        "device_age_days": device_age_days,
        "ip_velocity_1h": ip_velocity_1h,
        "failed_logins_24h": failed_logins_24h,
        "shipping_billing_mismatch": shipping_billing_mismatch,
        "email_age_days": email_age_days,
        "prior_chargebacks": prior_chargebacks,
        "device_shared_accounts": device_shared_accounts,
        "country_mismatch": country_mismatch,
        "card_bin_velocity": card_bin_velocity,
        "is_fraud": is_fraud,
        "data_origin": "synthetic",
    })
    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=12000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frame = generate_dataset(args.rows, args.seed)
    frame.to_csv(args.output, index=False)
    print(f"Saved {len(frame):,} synthetic rows to {args.output}")
    print(f"Fraud prevalence: {frame.is_fraud.mean():.2%}")
