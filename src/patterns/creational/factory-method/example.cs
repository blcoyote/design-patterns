// Usage
// [usage]
RunDelivery(new RoadLogistics()); // "Planned. Delivering by road in a truck"
RunDelivery(new SeaLogistics()); // "Planned. Delivering by sea in a ship"

static void RunDelivery(Logistics logistics)
{
    Console.WriteLine(logistics.PlanDelivery());
}
// [/usage]

// [transport]
interface ITransport
{
    string Deliver();
}
// [/transport]

// [truck]
class Truck : ITransport
{
    public string Deliver() => "Delivering by road in a truck";
}
// [/truck]

// [ship]
class Ship : ITransport
{
    public string Deliver() => "Delivering by sea in a ship";
}
// [/ship]

// [logistics]
abstract class Logistics
{
    // The factory method — subclasses decide what this returns.
    public abstract ITransport CreateTransport();

    // Shared logic that relies on CreateTransport() without knowing the concrete type.
    public string PlanDelivery()
    {
        var transport = CreateTransport();
        return $"Planned. {transport.Deliver()}";
    }
}
// [/logistics]

// [roadLogistics]
class RoadLogistics : Logistics
{
    public override ITransport CreateTransport() => new Truck();
}
// [/roadLogistics]

// [seaLogistics]
class SeaLogistics : Logistics
{
    public override ITransport CreateTransport() => new Ship();
}
// [/seaLogistics]
