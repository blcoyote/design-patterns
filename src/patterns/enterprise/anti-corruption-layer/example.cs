// [usage]
// Usage (top-level statements must come before type declarations in C#,
// so this runs first even though it reads last).
var trackingService = new OrderTrackingService(
    new ShippingAntiCorruptionLayer(new LegacyShippingSystem()));

Console.WriteLine(trackingService.Describe("O-1001"));
Console.WriteLine(trackingService.Describe("O-2002"));
// [/usage]

// [domainModel]
enum ShipmentStatus
{
    Pending,
    InTransit,
    Delivered,
    Unknown,
}

record Shipment(string OrderId, ShipmentStatus Status, DateOnly? EstimatedDelivery);
// [/domainModel]

// [legacySystem]
record LegacyShipmentRecord(string Trk, int Stat, string Eta); // stat: 0 pending, 1 in transit, 2 delivered — anything else is unmapped

class LegacyShippingSystem
{
    // [lookup]
    public LegacyShipmentRecord Lookup(string orderId)
    {
        if (orderId == "O-1001")
        {
            return new LegacyShipmentRecord(orderId, 1, "04/02/2025");
        }
        // O-2002: a corrupt record from the legacy system — an unmapped status code and an impossible date
        return new LegacyShipmentRecord(orderId, 9, "02/30/2025");
    }
    // [/lookup]
}
// [/legacySystem]

// [acl]
class ShippingAntiCorruptionLayer(LegacyShippingSystem legacy)
{
    // [translate]
    public Shipment GetShipment(string orderId)
    {
        var record = legacy.Lookup(orderId);
        return new Shipment(orderId, TranslateStatus(record.Stat), ParseEta(record.Eta));
    }

    private static ShipmentStatus TranslateStatus(int stat) =>
        stat switch
        {
            0 => ShipmentStatus.Pending,
            1 => ShipmentStatus.InTransit,
            2 => ShipmentStatus.Delivered,
            // An unmapped legacy code never reaches the domain as a raw number.
            _ => ShipmentStatus.Unknown,
        };

    private static DateOnly? ParseEta(string eta)
    {
        var parts = eta.Split('/');
        if (parts.Length != 3
            || !int.TryParse(parts[0], out var month)
            || !int.TryParse(parts[1], out var day)
            || !int.TryParse(parts[2], out var year))
        {
            // A malformed legacy date never reaches the domain either.
            return null;
        }
        try
        {
            return new DateOnly(year, month, day);
        }
        catch (ArgumentOutOfRangeException)
        {
            // The DateOnly constructor throws for an impossible calendar date (Feb 30, month 13, ...)
            // instead of rolling it over; catch that here so it never reaches the domain as a crash.
            return null;
        }
    }
    // [/translate]
}
// [/acl]

// [trackingService]
class OrderTrackingService(ShippingAntiCorruptionLayer acl)
{
    public string Describe(string orderId)
    {
        var shipment = acl.GetShipment(orderId);
        var eta = shipment.EstimatedDelivery?.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)
            ?? "unknown";
        return $"{shipment.OrderId}: {shipment.Status}, ETA {eta}";
    }
}
// [/trackingService]
