from typing import Protocol


# [paymentProcessor]
class PaymentProcessor(Protocol):
    def charge(self, amount: float) -> str: ...
# [/paymentProcessor]


# [adaptee]
class LegacyStripeGateway:
    # [chargeCents]
    def charge_cents(self, cents: int) -> dict[str, object]:
        print(f'legacy gateway: charging {cents}¢')
        return {'ok': True, 'cents': cents}
    # [/chargeCents]
# [/adaptee]


# [adapter]
class StripeAdapter:
    def __init__(self, gateway: LegacyStripeGateway) -> None:
        self._gateway = gateway

    # [charge]
    def charge(self, amount: float) -> str:
        cents = round(amount * 100)
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
