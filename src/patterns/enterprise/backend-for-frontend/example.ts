// [services]
// Shared backend services. They know nothing about the clients and return their
// data in one general shape. Each counts its calls first thing, so the usage can
// show which services a request reached.
interface Profile {
  readonly name: string;
  readonly email: string;
}

interface Order {
  readonly id: string;
  readonly items: number;
  readonly totalCents: number;
}

class ProfileService {
  calls = 0;
  private readonly profiles = new Map<string, Profile>([
    ["alice", { name: "Alice", email: "alice@example.com" }],
    ["bob", { name: "Bob", email: "bob@example.com" }],
  ]);

  profile(userId: string): Profile {
    this.calls++;
    const found = this.profiles.get(userId);
    if (found === undefined) {
      throw new Error(`unknown user ${userId}`);
    }
    return found;
  }
}

class OrderService {
  calls = 0;
  private readonly orders = new Map<string, Order[]>([
    [
      "alice",
      [
        { id: "order-1", items: 2, totalCents: 1250 },
        { id: "order-2", items: 3, totalCents: 4999 },
      ],
    ],
  ]);

  /** Oldest first; bob has no entry, so no orders. */
  recent(userId: string): Order[] {
    this.calls++;
    return this.orders.get(userId) ?? [];
  }
}

class RecommendationService {
  calls = 0;
  down = false; // the usage switches this on to show a failing service
  private readonly picks = new Map<string, string[]>([
    ["alice", ["socks", "mug", "lamp"]],
    ["bob", ["notebook"]],
  ]);

  forUser(userId: string): string[] {
    this.calls++;
    if (this.down) {
      throw new Error("recommendations unavailable");
    }
    return this.picks.get(userId) ?? [];
  }
}
// [/services]

// [webBff]
// The web team's backend. The account page shows everything, so it calls all
// three services and returns a page model shaped for the web UI. Calls run one
// after another here to keep the example deterministic; a real BFF would
// usually make independent calls in parallel.
interface AccountPage {
  readonly heading: string;
  readonly orderLines: string[];
  readonly recommended: string[] | null; // null: the section could not be filled
}

function formatCents(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

class WebBff {
  constructor(
    private readonly profiles: ProfileService,
    private readonly orders: OrderService,
    private readonly recommendations: RecommendationService,
  ) {}

  accountPage(userId: string): AccountPage {
    const profile = this.profiles.profile(userId);
    const orders = this.orders.recent(userId);
    let recommended: string[] | null;
    try {
      recommended = this.recommendations.forUser(userId);
    } catch {
      recommended = null; // the web page degrades: the rest of it is still served
    }
    return {
      heading: `${profile.name} (${profile.email})`,
      orderLines: orders.map(
        (order) => `${order.id}: ${order.items} items, ${formatCents(order.totalCents)}`,
      ),
      recommended,
    };
  }
}
// [/webBff]

// [mobileBff]
// The mobile team's backend. The app's home screen shows a small card, so this
// BFF calls only the two services it needs, never recommendations, and answers
// with compact JSON in the app's own field names.
interface MobileHomeCard {
  readonly name: string;
  readonly orderCount: number;
  readonly lastOrder: string | null;
}

class MobileBff {
  constructor(
    private readonly profiles: ProfileService,
    private readonly orders: OrderService,
  ) {}

  home(userId: string): string {
    const profile = this.profiles.profile(userId);
    const orders = this.orders.recent(userId);
    const card: MobileHomeCard = {
      name: profile.name,
      orderCount: orders.length,
      lastOrder: orders.length === 0 ? null : orders[orders.length - 1].id,
    };
    return JSON.stringify(card);
  }
}
// [/mobileBff]

// [clients]
// Each client knows only its own BFF, never the services behind it.
function showWebAccount(bff: WebBff, userId: string): void {
  const page = bff.accountPage(userId);
  console.log(`[web] ${page.heading}`);
  if (page.orderLines.length === 0) {
    console.log("[web]   no orders");
  }
  for (const line of page.orderLines) {
    console.log(`[web]   ${line}`);
  }
  const recommended = page.recommended === null ? "unavailable" : page.recommended.join(", ");
  console.log(`[web]   recommended: ${recommended}`);
}

function showMobileHome(bff: MobileBff, userId: string): void {
  console.log(`[mobile] ${bff.home(userId)}`);
}
// [/clients]

// [usage]
const profiles = new ProfileService();
const orders = new OrderService();
const recommendations = new RecommendationService();
const webBff = new WebBff(profiles, orders, recommendations);
const mobileBff = new MobileBff(profiles, orders);

showWebAccount(webBff, "alice"); // three service calls: heading, two order lines, three picks
showMobileHome(mobileBff, "alice"); // {"name":"Alice","orderCount":2,"lastOrder":"order-2"}
showMobileHome(mobileBff, "bob"); // {"name":"Bob","orderCount":0,"lastOrder":null}

console.log("[recommendations] down");
recommendations.down = true;
showWebAccount(webBff, "bob"); // no orders, recommended: unavailable

console.log(
  `service calls: profile ${profiles.calls}, orders ${orders.calls}, recommendations ${recommendations.calls}`,
); // profile 4, orders 4, recommendations 2
// [/usage]
