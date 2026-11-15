def address_risk(new_address: bool, amount: float):
    if new_address and amount >= 25000:
        return 22, ["New delivery address on a high-value electronics order"]
    if new_address:
        return 10, ["Recently added delivery address"]
    return 0, []
