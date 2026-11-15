
def account_risk(account_age_days: int, device_id: str):
    """
    Account takeover risk signals.

    Device IDs are not treated as suspicious merely because
    they have a particular demo prefix.
    """
    score = 0
    signals = []

    if account_age_days <= 3:
        score += 18
        signals.append("Very new account (3 days or less)")
    elif account_age_days <= 14:
        score += 8
        signals.append("Account age is under 14 days")

    return score, signals
