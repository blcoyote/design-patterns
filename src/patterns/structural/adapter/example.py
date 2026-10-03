import math
from typing import Protocol, TypedDict


# [paymentProcessor]
class PaymentProcessor(Protocol):
    def charge(self, amount: float) -> str: ...
# [/paymentProcessor]


class ChargeResult(TypedDict):
    ok: bool
    cents: int


# [adaptee]
class LegacyStripeGateway:
    # [chargeCents]
    def charge_cents(self, cents: int) -> ChargeResult:
        print(f'legacy gateway: charging {cents}¢')
        return {'ok': True, 'cents': cents}
    # [/chargeCents]
# [/adaptee]


# [adapter]
class StripeAdapter:
    def __init__(self, gateway: LegacyStripeGateway) -> None:
        self._gateway = gateway  # private by convention: clients only ever talk to the adapter

    # [charge]
    def charge(self, amount: float) -> str:
        # floor(x + 0.5) matches JS Math.round; Python's round() rounds halves to even.
        cents = math.floor(amount * 100 + 0.5)
        result = self._gateway.charge_cents(cents)
        if result['ok']:
            return f"charged ${result['cents'] / 100:.2f}"
        return 'failed'
    # [/charge]
# [/adapter]


# [usage]
# Usage
def checkout(processor: PaymentProcessor, amount: float) -> None:
    print(processor.charge(amount))


checkout(StripeAdapter(LegacyStripeGateway()), 4.5)
# [/usage]
