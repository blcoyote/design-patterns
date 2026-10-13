// [services]
/**
 * The shared backend services. Each counts its calls: the counter goes up at the start of
 * every call, before anything can fail, so a call that fails is still counted. Money is
 * integer cents everywhere. A sku a service does not know is a programmer bug, so it throws.
 */
class CatalogService {
  calls = 0;
  private readonly names = new Map<string, string>([["sku-1", "Widget"]]);

  name(sku: string): string {
    this.calls++;
    const name = this.names.get(sku);
    if (name === undefined) throw new Error(`unknown sku ${sku}`);
    return name;
  }
}

class PricingService {
  calls = 0;
  private readonly prices = new Map<string, number>([["sku-1", 1999]]);

  priceCents(sku: string): number {
    this.calls++;
    const cents = this.prices.get(sku);
    if (cents === undefined) throw new Error(`unknown sku ${sku}`);
    return cents;
  }
}

class StockService {
  calls = 0;
  private readonly units = new Map<string, number>([["sku-1", 3]]);

  inStock(sku: string): number {
    this.calls++;
    const units = this.units.get(sku);
    if (units === undefined) throw new Error(`unknown sku ${sku}`);
    return units;
  }
}

/** The one service that can be switched off, to show that a failure stays inside its team's slot. */
class RecommendationService {
  calls = 0;
  private down = false;
  private readonly relatedBySku = new Map<string, string[]>([["sku-1", ["Gadget", "Gizmo"]]]);

  setDown(down: boolean): void {
    this.down = down;
  }

  related(sku: string): string[] {
    this.calls++;
    if (this.down) throw new Error("recommendation service unavailable");
    const names = this.relatedBySku.get(sku);
    if (names === undefined) throw new Error(`unknown sku ${sku}`);
    return [...names];
  }
}

/** Formats 1999 as "19.99" and -250 as "-2.50" with integer arithmetic only (no floats, no thousands separator). */
function formatCents(cents: number): string {
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = absolute % 100;
  return `${cents < 0 ? "-" : ""}${whole}.${String(fraction).padStart(2, "0")}`;
}
// [/services]

// [shell]
/**
 * What every team hands to the shell: who owns the fragment, which release it is, and a
 * render function that returns an HTML string for one product.
 *
 * Fragments here return strings built from trusted constant data. A real fragment must
 * escape every value it puts into markup (names, prices, user input), or it opens the page
 * to injection.
 */
interface Fragment {
  readonly team: string;
  readonly version: string;
  render(sku: string): string;
}

/**
 * Which fragment each team currently serves. register adds a fragment without a word (the
 * set the shell starts with); deploy is the later release path: it replaces that team's
 * fragment and says so. Either way the team keeps its one slot, and the order of the page
 * comes only from the shell's template, never from this map.
 */
class FragmentRegistry {
  private readonly fragments = new Map<string, Fragment>();

  register(fragment: Fragment): void {
    this.fragments.set(fragment.team, fragment);
  }

  deploy(fragment: Fragment): void {
    this.fragments.set(fragment.team, fragment);
    console.log(`[registry] ${fragment.team} deployed ${fragment.version}`);
  }

  get(team: string): Fragment {
    const fragment = this.fragments.get(team);
    // A template slot nobody has registered is a programmer bug, not a failed fragment.
    if (fragment === undefined) throw new Error(`no fragment registered for ${team}`);
    return fragment;
  }
}

/**
 * The shell, owned by a platform team: it composes the page. These examples compose on the
 * server, like Server-Side Includes, Edge-Side Includes, Zalando's Tailor or FINN.no's
 * Podium, because they must run as plain code in TypeScript, C#, Python and Go. Many real
 * micro-frontends compose in the browser instead: Webpack Module Federation, Web
 * Components, single-spa or iframes. Neither way is the only one.
 *
 * The page template is an ordered list of slots. renderPage walks that list, never the
 * registry, so the order is the same on every run. If a fragment fails, the shell puts a
 * comment in its slot and carries on: one team's failure does not take the page down.
 */
class Shell {
  private readonly slots = ["product", "checkout", "inspire"];

  constructor(private readonly registry: FragmentRegistry) {}

  renderPage(sku: string): string {
    const parts: string[] = [];
    for (const team of this.slots) {
      const fragment = this.registry.get(team);
      try {
        parts.push(fragment.render(sku));
      } catch {
        parts.push(`<!-- ${team} unavailable -->`);
      }
    }
    return `<main>${parts.join("")}</main>`;
  }
}
// [/shell]

// [productTeam]
/** The Product team's fragment: the product's name as a heading, read from the catalog. */
class ProductFragment implements Fragment {
  readonly team = "product";
  readonly version = "product-details v1";

  constructor(private readonly catalog: CatalogService) {}

  render(sku: string): string {
    return `<h1>${this.catalog.name(sku)}</h1>`;
  }
}
// [/productTeam]

// [checkoutTeam]
/** The one thing the buy box needs to know about a product. */
interface BuyBoxModel {
  readonly priceCents: number;
  readonly inStock: number;
}

/**
 * The Checkout team's backend for its own web fragment (the Checkout web BFF). It puts one
 * call in front of two services (a facade) and reshapes their answers into the buy box's
 * model (an adapter): that shape and nothing more.
 */
class CheckoutWebBff {
  constructor(
    private readonly pricing: PricingService,
    private readonly stock: StockService,
  ) {}

  buyBox(sku: string): BuyBoxModel {
    const priceCents = this.pricing.priceCents(sku);
    const inStock = this.stock.inStock(sku);
    return { priceCents, inStock };
  }
}

/** Release 1 of the buy box: the price and how many are left. */
class BuyBoxV1 implements Fragment {
  readonly team = "checkout";
  readonly version = "buy-box v1";

  constructor(private readonly bff: CheckoutWebBff) {}

  render(sku: string): string {
    const model = this.bff.buyBox(sku);
    return `<button>Buy for ${formatCents(model.priceCents)} (${model.inStock} left)</button>`;
  }
}

/**
 * Release 2 of the buy box, shipped by the Checkout team alone: new wording, and it no
 * longer shows the stock count. It still asks the BFF for the whole model, so pricing and
 * stock are both still called.
 */
class BuyBoxV2 implements Fragment {
  readonly team = "checkout";
  readonly version = "buy-box v2";

  constructor(private readonly bff: CheckoutWebBff) {}

  render(sku: string): string {
    const model = this.bff.buyBox(sku);
    return `<button>Add to basket: ${formatCents(model.priceCents)}</button>`;
  }
}
// [/checkoutTeam]

// [inspireTeam]
/**
 * The Inspire team's fragment: a list of related products. It does not catch the service's
 * error; deciding what the page does when this fragment fails is the shell's job.
 */
class RecommendationsFragment implements Fragment {
  readonly team = "inspire";
  readonly version = "recommendations v1";

  constructor(private readonly recommendations: RecommendationService) {}

  render(sku: string): string {
    const items = this.recommendations.related(sku).map((name) => `<li>${name}</li>`);
    return `<ul>${items.join("")}</ul>`;
  }
}
// [/inspireTeam]

// [mobileBff]
/** What the mobile app gets for a product: strings and a flag, ready to show. */
interface MobileProductCard {
  readonly name: string;
  readonly price: string;
  readonly inStock: boolean;
}

/**
 * The Mobile team's backend, built for one client type, the mobile app. It puts one call in
 * front of three services (a facade) and reshapes their answers into the app's own card
 * (an adapter): a formatted price and a yes/no instead of a count.
 */
class MobileBff {
  constructor(
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly stock: StockService,
  ) {}

  productCard(sku: string): MobileProductCard {
    const name = this.catalog.name(sku);
    const cents = this.pricing.priceCents(sku);
    const units = this.stock.inStock(sku);
    return { name, price: formatCents(cents), inStock: units > 0 };
  }
}

/**
 * The compact JSON the app receives, written out by hand so every language prints the same
 * characters: no spaces, keys in this order. The values here are trusted constants; a real
 * serializer would escape them.
 */
function toWire(card: MobileProductCard): string {
  return `{"name":"${card.name}","price":"${card.price}","inStock":${card.inStock ? "true" : "false"}}`;
}
// [/mobileBff]

// [usage]
const catalog = new CatalogService();
const pricing = new PricingService();
const stock = new StockService();
const recommendations = new RecommendationService();

const checkoutBff = new CheckoutWebBff(pricing, stock);
const mobileBff = new MobileBff(catalog, pricing, stock);

// The shell starts with these three fragments. register is silent; deploy, used later, prints.
const registry = new FragmentRegistry();
registry.register(new ProductFragment(catalog));
registry.register(new BuyBoxV1(checkoutBff));
registry.register(new RecommendationsFragment(recommendations));
const shell = new Shell(registry);

console.log(`page: ${shell.renderPage("sku-1")}`);
console.log(`mobile: ${toWire(mobileBff.productCard("sku-1"))}`);

// The Checkout team ships a new buy box. No other team and not the shell is redeployed.
registry.deploy(new BuyBoxV2(checkoutBff));

// The recommendation service fails; the page still renders, without that fragment.
recommendations.setDown(true);
console.log("[inspire] recommendation service goes down");
console.log(`page: ${shell.renderPage("sku-1")}`);

console.log(
  `service calls: catalog ${catalog.calls}, pricing ${pricing.calls}, stock ${stock.calls}, recommendations ${recommendations.calls}`,
);
// [/usage]
