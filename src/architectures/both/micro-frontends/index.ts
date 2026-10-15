import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { MicroFrontendsVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "micro-frontends",
  name: "Micro-frontends with Backends-for-Frontends",
  paradigm: "both",
  order: 19,
  summary:
    "Split the UI by team: each team owns a fragment of the page and a shell composes the fragments; where a client or fragment needs data in its own shape, a backend-for-frontend owned by that team provides it.",
  intent:
    "Micro-frontends carry the idea of independently owned and deployed services into the user interface: instead of one frontend that every team edits and releases together, each team owns a fragment of the page and ships it on its own, and a shell composes the fragments into one page. A backend-for-frontend (BFF) is the other half of the same idea. It is a backend that belongs to one kind of client or one experience, and it does the work of calling the shared services and shaping their answers into exactly what that UI needs, so the UI does not have to. Sam Newman describes the BFF this way, drawing on SoundCloud's experience. The two are taught together here because a common arrangement is that a team owns a slice from the visible fragment down to the backend that feeds it; in this example only the Checkout team does, while the Product and Inspire fragments call the shared services directly and the Mobile team owns only a BFF. This example composes on the server, as a simplification (see the note under the diagram and the real-world section); it is not the only way, and many real systems compose in the browser.",
  problem:
    "A product page is built by one big frontend that the product, checkout and inspiration teams all edit. Every release has to be agreed with everyone: the checkout team cannot change its buy button without a build and a test run that cover the other teams' work, and one broken fragment can fail the whole page. The backend does not fit either. The services that hold the catalog, prices and stock are shared, and each UI has to call several of them and stitch the answers together, so the frontend code learns about every service. A mobile app needs different data in a different shape from the web page, and one general-purpose API ends up either too big for the app or too small for the page.",
  solution:
    "Cut the page along team lines. The Product team owns a fragment for the product's name, the Checkout team owns the buy box, and the Inspire team owns the recommendations; each fragment is a unit with a team, a version and a way to render itself. A shell, owned by a platform team, keeps a registry of which fragment each team currently serves and a page template, an ordered list of slots. To build a page it walks the template, asks each team's fragment to render, and joins the parts. If a fragment fails, the shell puts a comment in that slot and serves the rest of the page. Where a fragment needs data from several services, the team puts a backend-for-frontend between them: the Checkout web BFF calls pricing and then stock, and returns the small model the buy box needs, a price and a count. The mobile app, a different kind of client, gets its own Mobile BFF that calls catalog, pricing and stock and returns the card the app shows, as compact JSON. When the Checkout team releases a new buy box, it deploys that one fragment: nothing else is released and the shell is unchanged. In this example everything is in one process with no real network, and the shell composes the fragments on the server.",
  analogy:
    "A shopping street with one owner per shop. The street has a signboard and a pavement that everyone shares (the shell), but each shop decides what is in its own window and when to change it, and a shop whose lights have failed does not close the street. Behind each shop that needs it is its own stockroom that arranges goods for that shop's window (the BFF). The delivery van that serves the mobile-order desk packs its boxes differently from the one that serves the shop floor, because the two customers want different things. The street is only a picture of the idea: in the example the shell assembles the whole street itself, before anyone walks down it.",
  whenToUse: [
    "Several teams work on one user-facing page or app, and a shared frontend release is the bottleneck: each team wants to ship its part when it is ready.",
    "The page splits into parts with clear owners (here product, checkout and inspiration), where each part can live without knowing the others' internals.",
    "A UI needs data from several services in a shape that suits it, or different clients (web, mobile) need clearly different data: a BFF per client or experience keeps that shaping out of both the UI and the shared services.",
    "Do NOT use it for a small team or a small app: a modular monolith or a single frontend is far simpler. Independent fragments cost you in page weight, duplicated libraries, an inconsistent look and feel, and cross-fragment features such as shared state, navigation and one overall design. A BFF is another thing to build, deploy and keep in step with the services behind it.",
  ],
  pros: [
    "Teams ship independently. In the example the Checkout team deploys buy-box v2 and the registry only prints '[registry] checkout deployed buy-box v2'; the product and inspire fragments and the shell are not touched.",
    "A failing part does not fail the page. When the recommendation service goes down, the Inspire fragment fails, the shell puts '<!-- inspire unavailable -->' in its slot, and the product name and the buy box are still served.",
    "The UI stays thin. The buy box does not know that two services stand behind it: it asks the Checkout web BFF for one model, and release v2 changes its wording and drops the stock count while the services stay as they are.",
    'Each client gets the data it needs in its shape. The Mobile BFF turns the services\' answers into a card with a formatted price and a yes/no for stock, and the app receives {"name":"Widget","price":"19.99","inStock":true} instead of a count and a number of cents.',
    "Team ownership and the architecture line up. A team owns its fragment and, where it has one, the BFF behind it, so a change that spans the UI and the data it shows stays inside one team.",
  ],
  cons: [
    "It is more moving parts than one frontend. Every fragment is a separately released unit that the shell must find and run; the shell must be kept small and must not become the place where business logic leaks in.",
    "The page can feel stitched together. Fragments built by different teams need a shared design language, shared libraries and agreed behaviour for navigation, authentication and shared state; this example has none of that because its fragments are strings of HTML.",
    "This simulation does not show the hard parts of composition. Real shells fetch fragments concurrently, with timeouts and often caching, and the fragments' scripts and styles must not collide in the browser; here the shell renders the three fragments one after another, in the order of the template, and a failure is just a thrown exception (a returned error in Go).",
    "A BFF is duplication by design. The Checkout web BFF and the Mobile BFF both call pricing and stock and both reshape the answers. That is the price of letting each team move at its own speed, but without discipline the BFFs repeat logic that belongs in the shared services.",
    "Every BFF is another backend to own, deploy, monitor and keep in step with the services it calls. Not every team needs one: in this example only the Checkout team has a web BFF; the product and inspire fragments call their services directly.",
    "The example is only server-side composition, and its fragments return HTML strings built from trusted constant data. A real fragment must escape every value it puts into markup, or it opens the page to injection.",
  ],
  realWorld: [
    "Server-side composition is a real approach and not only a teaching simplification. Server-Side Includes and Edge-Side Includes are mechanisms in web servers and CDNs for pulling fragments into a page before it is sent. Zalando's open source Tailor and FINN.no's open source Podium are layout services that compose a page from fragments served by separate teams. The shell in this example plays that role in a much simpler form.",
    "Many real micro-frontends compose in the browser instead. Webpack Module Federation (a Webpack feature) lets separately built and deployed bundles load code from each other at run time; Web Components give each team a custom element the page can place; single-spa is a framework that mounts several applications on one page; and iframes isolate each fragment completely. Which approach fits depends on how much isolation, performance and shared behaviour you need; neither side is the only way.",
    "The Backend for Frontend pattern is described by Sam Newman, drawing on SoundCloud's experience of giving each kind of client its own backend instead of one general API. A BFF is usually owned by the same team as the UI it serves, and it is a different thing from a general API gateway, which is one shared entry point for all clients.",
    "The term micro-frontends appeared around 2016, and the idea of extending the microservice style of independent teams and deployments into the UI is how it is usually explained. Real systems differ a great deal in how far they go, from a handful of fragments on one page to whole applications mounted side by side.",
  ],
  concepts: [
    {
      term: "Fragment",
      description:
        "What a team hands to the shell: its team name, a version and a render operation that returns an HTML string for one product. It is an interface in TypeScript, C# (IFragment) and Go, and a Protocol in Python; in Go, Render returns the HTML and an error. ProductFragment, BuyBoxV1, BuyBoxV2 and RecommendationsFragment are the four implementations. They build strings from trusted constants; a real fragment must escape what it puts into markup.",
    },
    {
      term: "Shell",
      description:
        "The composition layer, owned by a platform team. It holds a page template, an ordered list of slots (product, checkout, inspire), and renderPage walks that list, asks the registry for each team's current fragment and joins what they render between <main> and </main>. If a fragment fails, the shell inserts <!-- team unavailable --> and carries on. The order comes from the template and never from the registry, so every run puts the parts in the same order.",
    },
    {
      term: "Fragment registry",
      description:
        "Maps each team to the fragment it currently serves. register adds a fragment silently (the set the shell starts with); deploy is the release path: it replaces that team's fragment and prints [registry] <team> deployed <version>. A team keeps its one slot when it deploys. Asking for a team nobody has registered is a programmer bug and not a failed fragment.",
    },
    {
      term: "Backend for Frontend (BFF)",
      description:
        "A backend that belongs to one UI or one kind of client. It calls the shared services and shapes their answers into what that UI needs, nothing more. Here there are two: the Checkout web BFF (for the buy box) and the Mobile BFF (for the mobile app). It is a facade, one call in front of several services, and an adapter, because it reshapes the answers into the client's own model.",
    },
    {
      term: "Checkout web BFF",
      description:
        "buyBox(sku) calls pricing and then stock, and returns a BuyBoxModel: the price in cents and the number in stock. The buy box formats the price itself. Only the Checkout team has a web BFF in this example.",
    },
    {
      term: "Mobile BFF",
      description:
        "productCard(sku) calls catalog, then pricing, then stock, and returns a MobileProductCard: the name, the price already formatted as a string, and inStock as a yes/no. toWire writes that card as compact JSON by hand, so the characters are the same in all four languages: no spaces and keys in this order. It exists for one client type, the mobile app.",
    },
    {
      term: "Shared services",
      description:
        "CatalogService, PricingService, StockService and RecommendationService stand for services that several UIs use. Each counts its calls, and the counter goes up before anything can fail, so a failed call is still counted. RecommendationService can be switched off with setDown; then related throws (a returned error in Go). An unknown sku is a programmer bug here and is not exercised.",
    },
    {
      term: "Vertical slice of ownership",
      description:
        "A team owns its fragment and the backend behind it, not just a layer. The Product team owns the product fragment, the Checkout team the buy box and the Checkout web BFF, the Inspire team the recommendations fragment, and the Mobile team the Mobile BFF. The dashed boxes in the diagram show that ownership. The shared services and the shell are not in any of those boxes.",
    },
    {
      term: "Composition: server-side or browser-side",
      description:
        "The step that turns separate fragments into one page. This example composes on the server, like Server-Side Includes and Edge-Side Includes, Zalando's Tailor or FINN.no's Podium, because the examples must run as plain code in TypeScript, C#, Python and Go. Many real micro-frontends compose in the browser instead: Webpack Module Federation, Web Components, single-spa or iframes.",
    },
  ],
  variants: [
    {
      name: "Browser-side composition",
      description:
        "The shell is a small page in the browser that loads each team's code and mounts it, for example with Webpack Module Federation, Web Components, single-spa or iframes. Teams ship JavaScript instead of HTML strings, the page can update in place without a reload, and the cost moves to the client: more code to download, and fragments that share one browser page have to avoid colliding.",
    },
    {
      name: "Edge or build-time composition",
      description:
        "Composition does not have to happen per request in an application server: it can be done at a CDN edge (Edge-Side Includes) or when the page is built, from fragments published as packages. A build-time shell is simple, but all the fragments are released together again, which gives up much of the independence.",
    },
    {
      name: "One BFF per client type or per experience",
      description:
        "The Mobile BFF here is per client type, and the Checkout web BFF is for one experience on the web. Teams choose differently: one BFF per client type (web, iOS, Android), one per team, or none where a fragment can call the services directly, as the product and inspire fragments do here.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "backend-for-frontend",
        why: "CheckoutWebBff and MobileBff are each a backend for one client or experience: CheckoutWebBff.buyBox serves only the web buy box, and MobileBff.productCard serves only the mobile app, with its own field names and JSON. The Backend for Frontend pattern page shows the same idea on its own, with a web and a mobile BFF over shared services and the web BFF degrading when one of them fails.",
      },
      {
        slug: "facade",
        why: "Both BFFs put one simple call in front of several services. CheckoutWebBff.buyBox calls pricing and then stock, and MobileBff.productCard calls catalog, pricing and stock, so the buy box and the mobile app each make one call and know nothing about how many services stand behind it.",
      },
      {
        slug: "adapter",
        why: "Both BFFs reshape what the services return into the model their client expects. CheckoutWebBff turns a price in cents and a stock count into a BuyBoxModel; MobileBff turns the same kind of answers into a MobileProductCard with a formatted price and an inStock flag, which toWire then writes as JSON. The services do not change to suit either client.",
      },
    ],
    architectures: [
      {
        slug: "microservices",
        why: "Micro-frontends carry the split by team up into the UI, on top of services like these. On the Micro-frontends page CatalogService, PricingService, StockService and RecommendationService stand for shared backend services. The Product and Inspire fragments call them directly, while two backends-for-frontends reshape their answers for one client or experience each: CheckoutWebBff.buyBox for the web buy box and MobileBff.productCard for the mobile app. That is a different thing from ApiGateway here, which is one shared entry point that only forwards placeOrder to OrderService, where a BFF is one backend per client or experience. There is no gateway on the Micro-frontends page, and only the Checkout fragment has a BFF: the product and inspire fragments call their services directly.",
      },
      {
        slug: "vertical-slice",
        why: "Both cut by ownership instead of by technical layer: a team owns its fragment and the backend behind it, as a slice owns its request, handler and data access. The difference is the unit of release. PlaceOrder and GetOrder here are in one program: they share the Mediator, the pipeline and OrdersTable and are deployed together, while on the Micro-frontends page registry.deploy(new BuyBoxV2(...)) replaces one team's fragment and nothing else is redeployed. A fragment also renders HTML for a shell to compose, where a slice handles one request, and a team's BFF could itself be organised in slices, which neither page shows.",
      },
      {
        slug: "mvc",
        why: "Both separate presenting from the data behind it, but at different scale. On the MVC page one app has a TodoModel that TodoListView and RemainingCountView observe, with a TodoController for input. On the Micro-frontends page the views are small and owned by different teams: ProductFragment, BuyBoxV1, BuyBoxV2 and RecommendationsFragment, which Shell.renderPage composes into one page. They share no model and observe nothing: each fragment fetches what it needs when it is rendered (from a service, or from CheckoutWebBff for the buy box), and the example has no input handling and so no controller. A team could build the inside of its fragment as MVC, which that page does not show.",
      },
    ],
  },

  viewBox: "0 0 1200 800",
  participants: [
    {
      id: "browser",
      label: "Browser",
      role: "Web client",
      kind: "client",
      x: 780,
      y: 70,
      width: 150,
      description:
        "The usage code playing a browser: it asks the shell for the product page and prints what comes back. Here it is only a caller; there is no real browser and no real HTTP request.",
      code: "usage",
    },
    {
      id: "mobileApp",
      label: "Mobile app",
      role: "Mobile client",
      kind: "client",
      x: 410,
      y: 70,
      width: 150,
      description:
        "The usage code playing the mobile app: it asks the Mobile BFF for the product card and prints the JSON it gets. It never calls the shell or the fragments.",
      code: "usage",
    },
    {
      id: "shell",
      label: "Page shell",
      role: "Composition (platform team)",
      kind: "class",
      x: 780,
      y: 210,
      width: 220,
      description:
        "Composes the page. renderPage walks the template's slots (product, checkout, inspire) in that order, asks the registry for each team's current fragment, calls render and joins the parts inside <main>. A fragment that fails gets <!-- team unavailable --> in its slot, and the page is still served. It composes on the server here, as Server-Side Includes, Tailor and Podium do; many real micro-frontends compose in the browser instead.",
      code: "shell",
    },
    {
      id: "productFragment",
      label: "product details",
      role: "Fragment (Product team)",
      kind: "class",
      x: 160,
      y: 370,
      width: 200,
      description:
        "The Product team's fragment, version product-details v1. It renders <h1> with the product's name, and it calls the catalog service directly: there is no BFF in front of it.",
      code: "productTeam",
    },
    {
      id: "buyBox",
      label: "buy box",
      role: "Fragment (Checkout team)",
      kind: "class",
      x: 810,
      y: 370,
      width: 190,
      description:
        "The Checkout team's fragment. Release 1 (buy-box v1) renders a button reading 'Buy for 19.99 (3 left)'; release 2 (buy-box v2) renders 'Add to basket: 19.99' and no longer shows the stock count. Both ask the Checkout web BFF for the same model, so pricing and stock are called either way. It is the only fragment here whose team deploys a new release.",
      code: "checkoutTeam",
    },
    {
      id: "recsFragment",
      label: "recommendations",
      role: "Fragment (Inspire team)",
      kind: "class",
      x: 1070,
      y: 370,
      width: 200,
      description:
        "The Inspire team's fragment, version recommendations v1. It renders a list with one item per related product (Gadget and Gizmo) from the recommendation service, which it calls directly. It does not catch the service's error: it fails, and the shell decides what the page does.",
      code: "inspireTeam",
    },
    {
      id: "checkoutBff",
      label: "Checkout web BFF",
      role: "BFF (Checkout team)",
      kind: "class",
      x: 810,
      y: 560,
      width: 210,
      description:
        "The Checkout team's backend for its own web fragment. buyBox(sku) calls pricing and then stock and returns just a price in cents and a stock count, the model the buy box needs. A facade (one call in front of two services) and an adapter (it reshapes the answers into the buy box's model).",
      patterns: ["facade", "adapter"],
      code: "checkoutTeam",
    },
    {
      id: "mobileBff",
      label: "Mobile BFF",
      role: "BFF (Mobile team, per client type)",
      kind: "class",
      x: 410,
      y: 500,
      width: 190,
      description:
        "The Mobile team's backend, built for one client type, the mobile app. productCard(sku) calls catalog, pricing and stock, in that order, and returns a card with the name, the price already formatted (19.99) and inStock as true or false. toWire writes the card as compact JSON by hand. A facade (one call in front of three services) and an adapter (it reshapes the answers into the app's card).",
      patterns: ["facade", "adapter"],
      code: "mobileBff",
    },
    {
      id: "catalog",
      label: "catalog",
      role: "Shared service",
      kind: "object",
      x: 160,
      y: 720,
      width: 150,
      description:
        "CatalogService: name(sku-1) returns Widget. Called by the product fragment and by the Mobile BFF; its counter reads 3 at the end (page, mobile, page).",
      code: "services",
    },
    {
      id: "pricing",
      label: "pricing",
      role: "Shared service",
      kind: "object",
      x: 410,
      y: 720,
      width: 150,
      description:
        "PricingService: priceCents(sku-1) returns 1999 (integer cents). Called by the Checkout web BFF and by the Mobile BFF; its counter reads 3 at the end (buy box v1, mobile, buy box v2).",
      code: "services",
    },
    {
      id: "stock",
      label: "stock",
      role: "Shared service",
      kind: "object",
      x: 810,
      y: 720,
      width: 150,
      description:
        "StockService: inStock(sku-1) returns 3. Called by the Checkout web BFF and by the Mobile BFF; its counter reads 3 at the end, like pricing.",
      code: "services",
    },
    {
      id: "recsService",
      label: "recommendation service",
      role: "Shared service (can go down)",
      kind: "object",
      x: 1070,
      y: 720,
      width: 200,
      description:
        "RecommendationService: related(sku-1) returns Gadget and Gizmo. It can be switched off with setDown(true); then every call throws 'recommendation service unavailable' (a returned error in Go), and the call is still counted. Its counter reads 2 at the end: one call that worked, one that failed.",
      code: "services",
    },
  ],
  relations: [
    {
      id: "request",
      from: "browser",
      to: "shell",
      type: "calls",
      label: "GET /product/sku-1",
      description:
        "The browser asks for the product page, which the shell builds. It gets the finished <main> string back. Here this is a function call (renderPage), not a real HTTP request.",
      code: "usage",
    },
    {
      id: "renderProduct",
      from: "shell",
      to: "productFragment",
      type: "calls",
      label: "render",
      bend: 60,
      description:
        "The shell's first slot is product: it asks the Product team's fragment to render.",
      code: "shell",
    },
    {
      id: "renderBuyBox",
      from: "shell",
      to: "buyBox",
      type: "calls",
      label: "render",
      description:
        "The second slot is checkout: the shell asks whichever buy box release is registered (v1 at first, v2 after the deploy) to render. It does not know or care which release it is.",
      code: "shell",
    },
    {
      id: "renderRecs",
      from: "shell",
      to: "recsFragment",
      type: "calls",
      label: "render",
      description:
        "The third slot is inspire. If this call fails (throws, or returns an error in Go), the shell catches it and puts <!-- inspire unavailable --> in the slot.",
      code: "shell",
    },
    {
      id: "name",
      from: "productFragment",
      to: "catalog",
      type: "calls",
      label: "name",
      description:
        "The product fragment asks the catalog for the product's name and wraps it in <h1>. No BFF stands in between.",
      code: "productTeam",
    },
    {
      id: "buyBoxModel",
      from: "buyBox",
      to: "checkoutBff",
      type: "calls",
      label: "buyBox",
      description:
        "The buy box asks its team's BFF for the model it needs and gets a price and a stock count back. It never calls pricing or stock itself.",
      code: "checkoutTeam",
    },
    {
      id: "price",
      from: "checkoutBff",
      to: "pricing",
      type: "calls",
      label: "priceCents",
      description: "The Checkout web BFF's first call: pricing (before stock).",
      code: "checkoutTeam",
    },
    {
      id: "inStock",
      from: "checkoutBff",
      to: "stock",
      type: "calls",
      label: "inStock",
      description: "The Checkout web BFF's second call: stock.",
      code: "checkoutTeam",
    },
    {
      id: "related",
      from: "recsFragment",
      to: "recsService",
      type: "calls",
      label: "related",
      description:
        "The recommendations fragment asks the service for the related products. While the service is down this call fails (and is still counted), and the fragment passes the failure up to the shell.",
      code: "inspireTeam",
    },
    {
      id: "productCard",
      from: "mobileApp",
      to: "mobileBff",
      type: "calls",
      label: "productCard",
      description:
        'The app asks the Mobile BFF for the card and gets the compact JSON {"name":"Widget","price":"19.99","inStock":true} back (the BFF builds the card; toWire writes it out).',
      code: "usage",
    },
    {
      id: "mobileName",
      from: "mobileBff",
      to: "catalog",
      type: "calls",
      label: "name",
      description: "The Mobile BFF's first call: catalog.",
      code: "mobileBff",
    },
    {
      id: "mobilePrice",
      from: "mobileBff",
      to: "pricing",
      type: "calls",
      label: "priceCents",
      description: "The Mobile BFF's second call: pricing.",
      code: "mobileBff",
    },
    {
      id: "mobileStock",
      from: "mobileBff",
      to: "stock",
      type: "calls",
      label: "inStock",
      description: "The Mobile BFF's third call: stock. The count becomes a yes/no for the app.",
      code: "mobileBff",
    },
  ],

  steps: [
    {
      title: "Teams own slices; a shell composes; each client has its backend",
      description:
        "The page is cut along team lines. The Product team owns the product fragment; the Checkout team owns the buy box and the Checkout web BFF behind it; the Inspire team owns the recommendations fragment; the Mobile team owns the Mobile BFF for the mobile app. A platform team's shell composes the fragments into one page. The dashed boxes show who owns what; the shared services belong to none of them. Honesty note: these examples compose on the server, like Server-Side Includes, Edge-Side Includes, Zalando's Tailor or FINN.no's Podium, because they must run as plain code in TypeScript, C#, Python and Go. Many real micro-frontends compose in the browser instead (Webpack Module Federation, Web Components, single-spa, iframes). Everything here runs in one process with no real network.",
      highlight: [
        "browser",
        "shell",
        "productFragment",
        "buyBox",
        "checkoutBff",
        "recsFragment",
        "mobileApp",
        "mobileBff",
      ],
      notes: {
        shell: "server-side composition",
        checkoutBff: "web BFF",
        mobileBff: "BFF per client type",
      },
      code: "usage",
    },
    {
      title: "The browser asks for the page; the shell walks its slots",
      description:
        "main builds the services, the registry and the shell, registers ProductFragment, BuyBoxV1 and RecommendationsFragment (register is silent, so nothing prints) and calls renderPage('sku-1'), which is the browser's request here. The shell does not iterate the registry: it walks its template, the ordered list product, checkout, inspire, and asks the registry for each team's current fragment. The next three steps follow the three slots in order.",
      highlight: ["browser", "request", "shell"],
      packets: [{ relation: "request", label: "GET /product/sku-1" }],
      notes: {
        shell: "slots: product, checkout, inspire",
      },
      code: "shell",
    },
    {
      title: "Product slot: <h1>Widget</h1> from the catalog",
      description:
        "The shell asks the product fragment to render. It calls the catalog directly (the Product team has no BFF), gets Widget (catalog call 1) and returns <h1>Widget</h1>.",
      highlight: ["shell", "renderProduct", "productFragment", "name", "catalog"],
      packets: [
        { relation: "renderProduct", label: "render" },
        { relation: "name", label: "name(sku-1)", after: 0 },
        { relation: "name", label: "Widget", reverse: true, after: 1 },
        { relation: "renderProduct", label: "<h1>Widget</h1>", reverse: true, after: 2 },
      ],
      notes: {
        catalog: "call 1",
        productFragment: "<h1>Widget</h1>",
      },
      code: "productTeam",
    },
    {
      title: "Checkout slot: the BFF calls pricing then stock",
      description:
        "The shell asks the buy box (buy-box v1) to render. The buy box asks the Checkout web BFF for its model. The BFF calls pricing (1999 cents) and then stock (3) and returns just a price and a stock count, the shape the buy box needs and nothing more. The buy box formats the price and returns <button>Buy for 19.99 (3 left)</button>. Pricing and stock now each have one call.",
      highlight: [
        "shell",
        "renderBuyBox",
        "buyBox",
        "buyBoxModel",
        "checkoutBff",
        "price",
        "pricing",
        "inStock",
        "stock",
      ],
      packets: [
        { relation: "renderBuyBox", label: "render" },
        { relation: "buyBoxModel", label: "buyBox(sku-1)", after: 0 },
        { relation: "price", label: "priceCents", after: 1 },
        { relation: "price", label: "1999", reverse: true, after: 2 },
        { relation: "inStock", label: "inStock", after: 3 },
        { relation: "inStock", label: "3", reverse: true, after: 4 },
        { relation: "buyBoxModel", label: "{ price, inStock }", reverse: true, after: 5 },
        {
          relation: "renderBuyBox",
          label: "Buy for 19.99 (3 left)",
          reverse: true,
          after: 6,
        },
      ],
      notes: {
        checkoutBff: "price + stock only",
        buyBox: "buy-box v1",
        pricing: "call 1",
        stock: "call 1",
      },
      code: "checkoutTeam",
    },
    {
      title: "Inspire slot: Gadget and Gizmo from the recommendation service",
      description:
        "The shell asks the recommendations fragment to render. It calls the recommendation service directly (recommendation call 1), gets Gadget and Gizmo and returns <ul><li>Gadget</li><li>Gizmo</li></ul>. The fragment does not catch the service's error; in this run there is none.",
      highlight: ["shell", "renderRecs", "recsFragment", "related", "recsService"],
      packets: [
        { relation: "renderRecs", label: "render" },
        { relation: "related", label: "related(sku-1)", after: 0 },
        { relation: "related", label: "Gadget, Gizmo", reverse: true, after: 1 },
        { relation: "renderRecs", label: "<ul>…</ul>", reverse: true, after: 2 },
      ],
      notes: {
        recsService: "call 1",
        recsFragment: "Gadget, Gizmo",
      },
      code: "inspireTeam",
    },
    {
      title: "The shell stitches the parts into one page",
      description:
        "The shell has the three parts, in template order, and joins them between <main> and </main>. The browser gets <main><h1>Widget</h1><button>Buy for 19.99 (3 left)</button><ul><li>Gadget</li><li>Gizmo</li></ul></main>, and main prints it as 'page: …'. Three teams, one page, and the shell knows nothing about prices or products: it only knows its slots.",
      highlight: ["browser", "request", "shell", "productFragment", "buyBox", "recsFragment"],
      packets: [{ relation: "request", label: "<main>…</main>", reverse: true }],
      notes: {
        shell: "3 parts joined",
        browser: "page received",
      },
      code: "shell",
    },
    {
      title: "The mobile app gets its own backend: compact JSON",
      description:
        'The mobile app asks the Mobile BFF for the product card. The BFF calls catalog (Widget), pricing (1999) and stock (3), in that order, and returns a card with the name, the price already formatted as 19.99 and inStock as true: a formatted price and a yes/no, not a number of cents and a count. toWire writes it by hand as {"name":"Widget","price":"19.99","inStock":true}, with no spaces, so all four languages print the same characters. This is a different backend for a different client type. Catalog, pricing and stock now each have 2 calls.',
      highlight: [
        "mobileApp",
        "productCard",
        "mobileBff",
        "mobileName",
        "catalog",
        "mobilePrice",
        "pricing",
        "mobileStock",
        "stock",
      ],
      packets: [
        { relation: "productCard", label: "productCard(sku-1)" },
        { relation: "mobileName", label: "name", after: 0 },
        { relation: "mobileName", label: "Widget", reverse: true, after: 1 },
        { relation: "mobilePrice", label: "priceCents", after: 2 },
        { relation: "mobilePrice", label: "1999", reverse: true, after: 3 },
        { relation: "mobileStock", label: "inStock", after: 4 },
        { relation: "mobileStock", label: "3", reverse: true, after: 5 },
        { relation: "productCard", label: "JSON card", reverse: true, after: 6 },
      ],
      notes: {
        mobileBff: "card for the app",
        catalog: "2 calls",
        pricing: "2 calls",
        stock: "2 calls",
      },
      code: "mobileBff",
    },
    {
      title: "The Checkout team deploys buy-box v2 on its own",
      description:
        "The Checkout team ships a new buy box: main calls registry.deploy(new BuyBoxV2(...)) and the registry prints '[registry] checkout deployed buy-box v2'. That replaces the checkout team's fragment in its one slot. Nothing else is redeployed: the product fragment, the recommendations fragment and the shell are unchanged, and the slot order still comes from the template. Release 2 has new wording and no stock count, but it still asks the BFF for the whole model, so pricing and stock will still be called.",
      highlight: ["buyBox", "buyBoxModel", "checkoutBff", "shell"],
      notes: {
        buyBox: "buy-box v2 deployed",
        shell: "unchanged",
        productFragment: "unchanged",
        recsFragment: "unchanged",
      },
      code: "checkoutTeam",
    },
    {
      title: "The recommendation service goes down",
      description:
        "main calls recommendations.setDown(true) and prints '[inspire] recommendation service goes down'. From now on every call to related fails: it throws 'recommendation service unavailable' in TypeScript, C# and Python, and returns that error in Go. The call is still counted before it fails. Nothing else has changed: the Inspire fragment has no special protection, and the shell is what copes with the failure in the next step.",
      highlight: ["recsService", "related", "recsFragment"],
      notes: {
        recsService: "down",
        recsFragment: "will fail",
      },
      code: "services",
    },
    {
      title: "Re-render: the failure stays in the inspire slot",
      description:
        "The same renderPage call again. Product renders <h1>Widget</h1> (catalog call 3). The new buy box asks the BFF, which calls pricing and stock (call 3 each), and renders <button>Add to basket: 19.99</button>. The recommendations fragment calls the service (recommendation call 2), which fails, and does not catch it, so the shell inserts <!-- inspire unavailable --> in that slot and carries on. The page is still served: <main><h1>Widget</h1><button>Add to basket: 19.99</button><!-- inspire unavailable --></main>. At the end the counters read catalog 3, pricing 3, stock 3, recommendations 2.",
      highlight: [
        "browser",
        "request",
        "shell",
        "renderProduct",
        "productFragment",
        "name",
        "catalog",
        "renderBuyBox",
        "buyBox",
        "buyBoxModel",
        "checkoutBff",
        "price",
        "pricing",
        "inStock",
        "stock",
        "renderRecs",
        "recsFragment",
        "related",
        "recsService",
      ],
      packets: [
        { relation: "renderProduct", label: "render" },
        { relation: "name", label: "name(sku-1)", after: 0 },
        { relation: "name", label: "Widget", reverse: true, after: 1 },
        { relation: "renderProduct", label: "<h1>Widget</h1>", reverse: true, after: 2 },
        { relation: "renderBuyBox", label: "render", after: 3 },
        { relation: "buyBoxModel", label: "buyBox(sku-1)", after: 4 },
        { relation: "price", label: "priceCents", after: 5 },
        { relation: "price", label: "1999", reverse: true, after: 6 },
        { relation: "inStock", label: "inStock", after: 7 },
        { relation: "inStock", label: "3", reverse: true, after: 8 },
        { relation: "buyBoxModel", label: "{ price, inStock }", reverse: true, after: 9 },
        {
          relation: "renderBuyBox",
          label: "Add to basket: 19.99",
          reverse: true,
          after: 10,
        },
        { relation: "renderRecs", label: "render", after: 11 },
        { relation: "related", label: "related(sku-1)", after: 12 },
        { relation: "related", label: "unavailable", reverse: true, after: 13 },
        { relation: "renderRecs", label: "fails", reverse: true, after: 14 },
        { relation: "request", label: "<main>…</main>", reverse: true, after: 15 },
      ],
      notes: {
        buyBox: "Add to basket: 19.99",
        recsFragment: "failed",
        shell: "<!-- inspire unavailable -->",
        catalog: "3 calls",
        pricing: "3 calls",
        stock: "3 calls",
        recsService: "2 calls (1 failed)",
      },
      code: "usage",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: MicroFrontendsVisualization,
};
