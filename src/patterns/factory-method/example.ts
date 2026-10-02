// [transport]
interface Transport {
  deliver(): string
}
// [/transport]

// [truck]
class Truck implements Transport {
  deliver(): string {
    return 'Delivering by road in a truck'
  }
}
// [/truck]

// [ship]
class Ship implements Transport {
  deliver(): string {
    return 'Delivering by sea in a ship'
  }
}
// [/ship]

// [logistics]
abstract class Logistics {
  // The factory method — subclasses decide what this returns.
  abstract createTransport(): Transport

  // Shared logic that relies on createTransport() without knowing the concrete type.
  planDelivery(): string {
    const transport = this.createTransport()
    return `Planned. ${transport.deliver()}`
  }
}
// [/logistics]

// [roadLogistics]
class RoadLogistics extends Logistics {
  createTransport(): Transport {
    return new Truck()
  }
}
// [/roadLogistics]

// [seaLogistics]
class SeaLogistics extends Logistics {
  createTransport(): Transport {
    return new Ship()
  }
}
// [/seaLogistics]

// Usage
// [usage]
function runDelivery(logistics: Logistics) {
  console.log(logistics.planDelivery())
}

runDelivery(new RoadLogistics()) // "Planned. Delivering by road in a truck"
runDelivery(new SeaLogistics()) // "Planned. Delivering by sea in a ship"
// [/usage]
