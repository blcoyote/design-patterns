// [paymentProcessor]
interface PaymentProcessor {
  charge(amount: number): string
}
// [/paymentProcessor]

// [adaptee]
class LegacyStripeGateway {
  // [chargeCents]
  chargeCents(cents: number): { ok: boolean; cents: number } {
    console.log(`legacy gateway: charging ${cents}¢`)
    return { ok: true, cents }
  }
  // [/chargeCents]
}
// [/adaptee]

// [adapter]
class StripeAdapter implements PaymentProcessor {
  constructor(private gateway: LegacyStripeGateway) {}

  // [charge]
  charge(amount: number): string {
    const cents = Math.round(amount * 100)
    const result = this.gateway.chargeCents(cents)
    return result.ok ? `charged $${(result.cents / 100).toFixed(2)}` : 'failed'
  }
  // [/charge]
}
// [/adapter]

// [usage]
// Usage
function checkout(processor: PaymentProcessor, amount: number) {
  console.log(processor.charge(amount))
}

checkout(new StripeAdapter(new LegacyStripeGateway()), 4.5)
// [/usage]
