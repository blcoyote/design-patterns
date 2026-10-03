type EventMap = {
  'order.placed': { orderId: string; total: number }
  'user.signedUp': { userId: string; email: string }
}

type Handler<T> = (payload: T) => void
type Unsubscribe = () => void

// [eventBus]
class EventBus<Events extends Record<string, unknown>> {
  private topics = new Map<keyof Events, Set<Handler<any>>>()

  // [subscribe]
  subscribe<K extends keyof Events>(topic: K, handler: Handler<Events[K]>): Unsubscribe {
    const handlers = this.topics.get(topic) ?? new Set()
    handlers.add(handler)
    this.topics.set(topic, handlers)
    return () => handlers.delete(handler)
  }
  // [/subscribe]

  publish<K extends keyof Events>(topic: K, payload: Events[K]): void {
    // [dispatch]
    // Loop over a snapshot so a handler that subscribes or unsubscribes
    // mid-publish doesn't affect the round we're already delivering.
    for (const handler of [...(this.topics.get(topic) ?? [])]) {
      handler(payload)
    }
    // [/dispatch]
  }
}

const bus = new EventBus<EventMap>()
// [/eventBus]

// [checkoutService]
class CheckoutService {
  constructor(private bus: EventBus<EventMap>) {}

  placeOrder(orderId: string, total: number) {
    // ...charge the card, persist the order...
    // [checkoutPublish]
    this.bus.publish('order.placed', { orderId, total })
    // [/checkoutPublish]
  }
}
// [/checkoutService]

// [userService]
class UserService {
  constructor(private bus: EventBus<EventMap>) {}

  signUp(userId: string, email: string) {
    // ...create the account...
    // [userPublish]
    this.bus.publish('user.signedUp', { userId, email })
    // [/userPublish]
  }
}
// [/userService]

// [emailService]
class EmailService {
  constructor(bus: EventBus<EventMap>) {
    bus.subscribe('order.placed', (e) => this.sendReceipt(e.orderId))
    bus.subscribe('user.signedUp', (e) => this.sendWelcome(e.email))
  }
  private sendReceipt(orderId: string) {
    console.log(`email: receipt for order ${orderId}`)
  }
  private sendWelcome(email: string) {
    console.log(`email: welcome ${email}`)
  }
}
// [/emailService]

// [analyticsService]
class AnalyticsService {
  constructor(bus: EventBus<EventMap>) {
    bus.subscribe('order.placed', (e) => this.track('order.placed', e))
    bus.subscribe('user.signedUp', (e) => this.track('user.signedUp', e))
  }
  private track(topic: string, payload: unknown) {
    console.log('analytics:', topic, payload)
  }
}
// [/analyticsService]

// [inventoryService]
class InventoryService {
  private stopListening: Unsubscribe

  constructor(bus: EventBus<EventMap>) {
    this.stopListening = bus.subscribe('order.placed', (e) => this.reserve(e.orderId))
  }
  private reserve(orderId: string) {
    console.log(`inventory: reserved stock for ${orderId}`)
  }

  // [unsubscribe]
  stopWatching() {
    this.stopListening()
  }
  // [/unsubscribe]
}
// [/inventoryService]

// Usage — nobody imports anybody else, only EventBus
const checkout = new CheckoutService(bus)
const users = new UserService(bus)
new EmailService(bus)
new AnalyticsService(bus)
const inventory = new InventoryService(bus)

checkout.placeOrder('A1', 42) // email, analytics and inventory all react
users.signUp('U1', 'ada@example.com') // only email and analytics react

inventory.stopWatching()
checkout.placeOrder('A2', 15) // email and analytics react; inventory does not
