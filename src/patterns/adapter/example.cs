// [usage]
// Usage (top-level statements must come before type declarations in C#,
// so this runs first even though it reads last).
static void Checkout(IPaymentProcessor processor, decimal amount)
{
    Console.WriteLine(processor.Charge(amount));
}

Checkout(new StripeAdapter(new LegacyStripeGateway()), 4.5m);
// [/usage]

// [paymentProcessor]
interface IPaymentProcessor
{
    string Charge(decimal amount);
}
// [/paymentProcessor]

// [adaptee]
class LegacyStripeGateway
{
    // [chargeCents]
    public (bool Ok, int Cents) ChargeCents(int cents)
    {
        Console.WriteLine($"legacy gateway: charging {cents}¢");
        return (true, cents);
    }
    // [/chargeCents]
}
// [/adaptee]

// [adapter]
class StripeAdapter(LegacyStripeGateway gateway) : IPaymentProcessor
{
    // [charge]
    public string Charge(decimal amount)
    {
        var cents = (int)Math.Round(amount * 100);
        var result = gateway.ChargeCents(cents);
        var dollars = result.Cents / 100m;
        return result.Ok ? $"charged ${dollars.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)}" : "failed";
    }
    // [/charge]
}
// [/adapter]
