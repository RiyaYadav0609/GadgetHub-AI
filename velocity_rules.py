
def velocity_risk(attempts_10m: int) -> tuple[int, list[str]]:
    """
    Score transaction velocity separately from card-testing patterns.
    This prevents duplicate velocity scoring.
    """
    if attempts_10m >= 20:
        return 55, [
            "Extreme payment velocity: 20+ attempts in 10 minutes"
        ]

    if attempts_10m >= 8:
        return 35, [
            "High payment velocity: 8+ attempts in 10 minutes"
        ]

    if attempts_10m >= 4:
        return 18, [
            "Elevated payment velocity: 4+ attempts in 10 minutes"
        ]

    return 0, []
