// [observer]
interface Observer {
  update(price: number): void
}
// [/observer]

// [subject]
class StockTicker {
  private observers: Observer[] = []
  private price = 0

  // [subscribe]
  subscribe(o: Observer) {
    this.observers.push(o)
  }
  // [/subscribe]

  // [unsubscribe]
  unsubscribe(o: Observer) {
    this.observers = this.observers.filter((x) => x !== o)
  }
  // [/unsubscribe]

  // [setPrice]
  setPrice(price: number) {
    this.price = price
    this.notify()
  }
  // [/setPrice]

  // [notify]
  private notify() {
    // observers is reassigned (not mutated in place) by unsubscribe, so an
    // observer that unsubscribes itself mid-notify doesn't affect the
    // array we're already looping over here.
    for (const o of this.observers) o.update(this.price)
  }
  // [/notify]
}
// [/subject]

// [concrete]
// [chart]
class PriceChart implements Observer {
  update(price: number) {
    console.log(`chart: plot ${price}`)
  }
}
// [/chart]

// [alert]
class PriceAlert implements Observer {
  constructor(private limit: number) {}
  update(price: number) {
    if (price > this.limit) console.warn(`price above ${this.limit}!`)
  }
}
// [/alert]

// [logger]
class AuditLog implements Observer {
  entries: number[] = []
  update(price: number) {
    this.entries.push(price)
  }
}
// [/logger]
// [/concrete]

// Usage
const ticker = new StockTicker()
const alert = new PriceAlert(100)
ticker.subscribe(new PriceChart())
ticker.subscribe(alert)
ticker.subscribe(new AuditLog())

ticker.setPrice(101.5) // all three react
ticker.unsubscribe(alert)
ticker.setPrice(99) // only chart + log
