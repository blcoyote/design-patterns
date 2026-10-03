type EventMap = {
  "order.placed": { orderId: string; total: number };
  "user.signedUp": { userId: string; email: string };
};

type Handler<T> = (payload: T) => void;
type Unsubscribe = () => void;

// One entry per subscribe() call, identified by object reference.
interface Subscription {
  handler: Handler<any>;
}

// [eventBus]
class EventBus<Events extends Record<string, unknown>> {
  // A list of subscriptions per topic, kept in subscription order.
  private topics = new Map<keyof Events, Subscription[]>();

  // [subscribe]
  subscribe<K extends keyof Events>(topic: K, handler: Handler<Events[K]>): Unsubscribe {
    // Each call gets its own subscription, so subscribing the same handler
    // twice delivers twice, and each unsubscribe removes only its own entry.
    const subscription: Subscription = { handler };
    const subscriptions = this.topics.get(topic) ?? [];
    subscriptions.push(subscription);
    this.topics.set(topic, subscriptions);
    return () => {
      const index = subscriptions.indexOf(subscription);
      if (index !== -1) subscriptions.splice(index, 1);
    };
  }
  // [/subscribe]

  publish<K extends keyof Events>(topic: K, payload: Events[K]): void {
    // [dispatch]
    // Loop over a snapshot so a handler that subscribes or unsubscribes
    // mid-publish doesn't affect the round we're already delivering.
    for (const { handler } of [...(this.topics.get(topic) ?? [])]) {
      handler(payload);
    }
    // [/dispatch]
  }
}

const bus = new EventBus<EventMap>();
// [/eventBus]

// [checkoutService]
class CheckoutService {
  constructor(private bus: EventBus<EventMap>) {}

  placeOrder(orderId: string, total: number) {
    // ...charge the card, persist the order...
    // [checkoutPublish]
    this.bus.publish("order.placed", { orderId, total });
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
    this.bus.publish("user.signedUp", { userId, email });
    // [/userPublish]
  }
}
// [/userService]

// [emailService]
class EmailService {
  constructor(bus: EventBus<EventMap>) {
    bus.subscribe("order.placed", (e) => this.sendReceipt(e.orderId));
    bus.subscribe("user.signedUp", (e) => this.sendWelcome(e.email));
  }
  private sendReceipt(orderId: string) {
    console.log(`email: receipt for order ${orderId}`);
  }
  private sendWelcome(email: string) {
    console.log(`email: welcome ${email}`);
  }
}
// [/emailService]

// [analyticsService]
class AnalyticsService {
  constructor(bus: EventBus<EventMap>) {
    bus.subscribe("order.placed", (e) =>
      this.track("order.placed", `orderId=${e.orderId} total=${e.total}`),
    );
    bus.subscribe("user.signedUp", (e) =>
      this.track("user.signedUp", `userId=${e.userId} email=${e.email}`),
    );
  }
  private track(topic: string, details: string) {
    console.log(`analytics: ${topic} ${details}`);
  }
}
// [/analyticsService]

// [inventoryService]
class InventoryService {
  private stopListening: Unsubscribe;

  constructor(bus: EventBus<EventMap>) {
    this.stopListening = bus.subscribe("order.placed", (e) => this.reserve(e.orderId));
  }
  private reserve(orderId: string) {
    console.log(`inventory: reserved stock for ${orderId}`);
  }

  // [unsubscribe]
  stopWatching() {
    this.stopListening();
  }
  // [/unsubscribe]
}
// [/inventoryService]

// Usage — nobody imports anybody else, only EventBus
const checkout = new CheckoutService(bus);
const users = new UserService(bus);
new EmailService(bus);
new AnalyticsService(bus);
const inventory = new InventoryService(bus);

checkout.placeOrder("A1", 42); // email, analytics and inventory all react
users.signUp("U1", "ada@example.com"); // only email and analytics react

inventory.stopWatching();
checkout.placeOrder("A2", 15); // email and analytics react; inventory does not
