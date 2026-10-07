// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
var price = Money.Of(1000, "EUR");
var shipping = Money.Of(250, "EUR");
var total = price.Add(shipping);
Console.WriteLine($"price {price}, total {total}");
// price 10.00 EUR, total 12.50 EUR
Console.WriteLine($"equal by value: {total.Equals(Money.Of(1250, "EUR")).ToString().ToLowerInvariant()}");
// equal by value: true

try
{
    Money.Of(-5, "EUR");
}
catch (ArgumentException e)
{
    Console.WriteLine($"rejected: {e.Message}");
}
// rejected: amount must be a whole number of cents from 0 to 1000000000000000
try
{
    price.Add(Money.Of(100, "USD"));
}
catch (ArgumentException e)
{
    Console.WriteLine($"rejected: {e.Message}");
}
// rejected: cannot add USD to EUR

var orderId = OrderId.Of("o-1");
var customerId = CustomerId.Of("c-1");
var order = new Order(orderId, customerId, total);
Console.WriteLine($"order {order.Id} for {order.Customer}, total {order.Total}");
// order o-1 for c-1, total 12.50 EUR
// [idSwap]
// new Order(customerId, orderId, total); // does not compile: CustomerId is not an OrderId
// [/idSwap]
Console.WriteLine($"same id: {order.Id.Equals(OrderId.Of("o-1")).ToString().ToLowerInvariant()}");
// same id: true
// [/client]

// [money]
// A value object: it has no identity, only its amount and currency. It is
// sealed and its properties are get-only, so it cannot change after creation.
// The amount is a whole number of cents, so there is no floating-point rounding.
// The upper bound keeps a sum of two amounts from overflowing.
sealed class Money : IEquatable<Money>
{
    public const long MaxCents = 1_000_000_000_000_000;

    public long Amount { get; }
    public string Currency { get; }

    private Money(long amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    // [moneyCreate]
    // The only way in, so an invalid Money cannot be created.
    public static Money Of(long amount, string currency)
    {
        if (amount < 0 || amount > MaxCents)
            throw new ArgumentException("amount must be a whole number of cents from 0 to 1000000000000000");
        // Checks the shape only. A real system would check a list of ISO 4217 codes.
        if (currency.Length != 3 || !currency.All(c => c is >= 'A' and <= 'Z'))
            throw new ArgumentException($"invalid currency {currency}");
        return new Money(amount, currency);
    }
    // [/moneyCreate]

    // [moneyAdd]
    // Returns a new Money. Neither operand changes. The sum goes back through
    // the factory, so it is checked like any other amount.
    public Money Add(Money other)
    {
        if (other.Currency != Currency)
            throw new ArgumentException($"cannot add {other.Currency} to {Currency}");
        return Of(Amount + other.Amount, Currency);
    }
    // [/moneyAdd]

    // [moneyEquals]
    // Equal by value: the same amount and currency are equal, whichever instance
    // holds them. Equal objects must hash equally, so GetHashCode matches Equals.
    public bool Equals(Money? other) =>
        other is not null && Amount == other.Amount && Currency == other.Currency;

    public override bool Equals(object? obj) => Equals(obj as Money);

    public override int GetHashCode() => HashCode.Combine(Amount, Currency);
    // [/moneyEquals]

    public override string ToString() => $"{Amount / 100}.{Amount % 100:D2} {Currency}";
}
// [/money]

// [orderId]
// A strongly typed id. OrderId and CustomerId are different types, so the
// compiler rejects one where the other is expected. A record compares by value.
sealed record OrderId
{
    public string Value { get; }

    private OrderId(string value) => Value = value;

    public static OrderId Of(string value) =>
        value == "" ? throw new ArgumentException("order id must not be empty") : new OrderId(value);

    public override string ToString() => Value;
}
// [/orderId]

// [customerId]
sealed record CustomerId
{
    public string Value { get; }

    private CustomerId(string value) => Value = value;

    public static CustomerId Of(string value) =>
        value == "" ? throw new ArgumentException("customer id must not be empty") : new CustomerId(value);

    public override string ToString() => Value;
}
// [/customerId]

// [order]
// An entity: identified by its id, not by its attributes. Its total is a value object.
class Order(OrderId id, CustomerId customer, Money total)
{
    public OrderId Id { get; } = id;
    public CustomerId Customer { get; } = customer;
    public Money Total { get; } = total;
}
// [/order]
