
def detect_card_testing(
    amount: float,
    attempts_10m: int,
    device_id: str
):
    """
    Detect low-value card-testing patterns.

    A single small transaction is not sufficient to classify
    a transaction as card testing.
    """
    score = 0
    signals = []

    if amount <= 5 and attempts_10m >= 8:
        score += 45
        signals.append(
            "Repeated micro-authorization pattern consistent with card testing"
        )

    return min(score, 80), signals
