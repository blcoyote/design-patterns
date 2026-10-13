import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { SidecarVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "sidecar",
  name: "Sidecar",
  category: "enterprise",
  order: 21,
  summary:
    "Run a helper next to each service instance that handles its outbound calls (identity, retries, metrics), so those concerns live outside the service's own code and can be changed without changing it.",
  intent:
    "Deploy a helper alongside each instance of a service and let it carry that instance's outbound calls. The helper adds the service's identity, retries transient failures and counts requests, so these concerns live outside the service's own code and can be changed without changing, rebuilding or redeploying the service.",
  problem:
    "Services that call other services usually need the same plumbing: presenting an identity, retrying a call that failed for a moment, counting requests. Written into each service, that code is repeated for each service and for each language in use, drifts apart between copies, and can only be changed by changing and redeploying the services themselves.",
  solution:
    'Let the service talk only to an outbound interface, and give it a Sidecar that provides that interface. OrderService builds a GET request for /stock/<sku> addressed to "inventory" and sends it through the outbound interface it was handed; it contains no identity, retry or metrics code. The Sidecar counts the request, makes a copy of it with an x-client-identity header set to its service name ("orders"), and passes the copy to its upstream, here the Network. If the answer is a 503 and fewer retries have been used than max retries allows (1 at first), it sends the same copy again; any other answer ends the loop. It then counts the retries, counts a failure if the final status is 400 or above, and prints a line. The Network looks up the service named in the request and hands it over to InventoryService, which counts the call, answers 401 if the identity header is missing, answers 503 for exactly one call after a scripted failure is armed, and otherwise answers 200. Because the retry limit is plain state in the Sidecar, the config reload changes it while OrderService stays as it is. The usage also wires a second OrderService straight to the Network, bypassing the Sidecar: the same app code now sends no identity header and gets a 401. The simulation is deliberately simple. The process boundary is simulated: the app and the Sidecar are two objects in one process and the "network" between them is a method call, whereas a real sidecar is a separate process or container deployed with each instance, usually in the same Kubernetes pod and sharing its network. A real mesh also redirects the app\'s traffic to the sidecar transparently (for example with iptables rules), so the app code does not change at all; here the Sidecar is handed to OrderService explicitly. And the identity header stands in for mutual TLS: a real sidecar presents a certificate on an encrypted connection, while here InventoryService only checks that the header is present, which is not secure. Compared with an API Gateway, which is one shared entry point at the edge for clients, a sidecar is one helper per service instance for that instance\'s outgoing calls. Compared with Middleware or a Decorator, which wrap calls inside the app\'s process and need the app code or a library for each language, a sidecar is a separate process and needs no change to the app.',
  analogy:
    "A personal assistant sitting next to each person in an office who handles all of that person's outgoing phone calls. The assistant identifies the company, redials when the line is busy and keeps the call log. The person only says whom to call and what to ask. Changing the redial rule means briefing the assistants, not retraining the people they sit with.",
  whenToUse: [
    "Many services, possibly written in several languages, need the same outbound behaviour (identity, retries, timeouts, metrics), and keeping one library per language in step costs too much.",
    "The behaviour has to change without rebuilding and redeploying each service, for example a retry limit or the certificates used to prove identity.",
    "The service code cannot be changed or should not know about the plumbing, for example a legacy or third-party service.",
    "The platform can run a helper next to each instance, as a Kubernetes pod can run several containers that share a network. The Microservices architecture page lists this as its Service mesh / sidecar variant.",
    "Not when a few services in one language can share a library or a Middleware chain: the sidecar's costs buy nothing there.",
  ],
  pros: [
    "The outbound concerns live in one place, the Sidecar. In this example OrderService has no identity, retry or metrics code, and the sidecar's counters (requests 3, attempts 4, retries 1, failures 1) are kept without it.",
    "A policy change needs no change to the app: the config reload sets max retries to 0 and the next transient 503 reaches OrderService, with the app code untouched.",
    "The helper is not tied to the service's language. In a real system the app only needs to be able to make a network call, so one sidecar can serve services written in different languages.",
    "A retry hides a short-lived failure from the app: in the second call the app sees only the 200, and the extra attempt is visible only in the sidecar's counters.",
    "A sidecar is deployed with its instance, so its resource use and its failures are scoped to that instance.",
  ],
  cons: [
    "Cost: an extra process per instance (CPU and memory), an extra local hop on each call that goes through it (latency), and more moving parts to upgrade and debug. Upgrading a sidecar usually means restarting the instances that carry it, and a failure may be caused, hidden or retried by a component the app's own logs do not show.",
    "The process boundary is simulated here. The app and the Sidecar are two objects in one process and the call between them is a method call, so this example cannot show the extra hop, the extra process or a sidecar that is down.",
    "Real meshes redirect the app's traffic to the sidecar transparently, for example with iptables rules, so the app code does not change at all. Here the Sidecar is handed to OrderService explicitly, so wiring it in is a change in the usage code.",
    "The identity header stands in for mutual TLS. A real sidecar presents a certificate on an encrypted connection; here any caller can set a plain header, and InventoryService only checks that it is present, which is not secure. In the bypass step the missing header is what gets the 401, not a verified identity.",
    "Retries are safe here only because the call is a GET, which can be repeated without side effects, and only a 503 is retried: a 401 is returned as it is. Retrying a call that changes state can apply the change twice unless the operation is idempotent. This example also retries at once, with no delay or backoff and no circuit breaker; real sidecars often offer those.",
    "This sidecar handles only the app's outbound calls, which makes it effectively the Ambassador pattern, a sidecar specialised for outbound calls. Real sidecars often also handle inbound traffic, log shipping or configuration.",
    "Anything that talks to the Network directly, as the second OrderService does in the bypass step, gets none of the sidecar's behaviour. A real mesh closes that gap by intercepting traffic transparently.",
  ],
  realWorld: [
    "Istio in sidecar mode, which injects an Envoy proxy next to the application container; Istio also has a sidecar-less ambient mode",
    "Linkerd, which injects its own proxy, linkerd2-proxy, next to the application container",
    "Dapr, which runs a daprd sidecar next to the app and exposes building-block APIs such as service invocation, state and pub/sub",
    "Kubernetes pods that pair an application container with helper containers for log shipping or configuration reloading",
    "The Service mesh / sidecar variant on the Microservices architecture page",
  ],
  related: ["proxy", "decorator", "middleware", "circuit-breaker", "api-gateway"],
  Visualization: SidecarVisualization,

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "operator",
      label: "Operator (config)",
      role: "Changes sidecar config",
      kind: "client",
      x: 480,
      y: 50,
      code: "sidecar",
      description:
        "Whoever changes the sidecar's settings without touching the app. In the example there is no operator class: the usage code plays this role and calls the config reload on the Sidecar, which sets max retries to 0. In a real mesh such settings usually come from a control plane.",
    },
    {
      id: "sidecar",
      label: "Sidecar",
      role: "Sidecar (outbound proxy)",
      kind: "class",
      x: 180,
      y: 180,
      code: "sidecar",
      description:
        'The helper next to the app. It provides the same outbound interface as the Network, so OrderService cannot tell which one it was given. Its send call counts the request, copies it with the x-client-identity header set to its service name ("orders"), and sends the copy upstream. It stops at the first answer that is not a 503, or when the attempts made for this request exceed max retries. It then adds the retries to its counters (requests, attempts, retries, failures), counts a failure if the final status is 400 or above, and prints a line. The process boundary is simulated: a real sidecar is a separate process or container deployed with each instance. The header stands in for mutual TLS and is not secure.',
    },
    {
      id: "app",
      label: "OrderService",
      role: "Service (app code)",
      kind: "class",
      x: 180,
      y: 340,
      code: "app",
      description:
        'The application code. Its stock check builds a GET request for /stock/<sku> addressed to "inventory", sends it through the outbound interface it holds, and prints the status and body it gets back. There is no identity, retry or metrics code in it. Real meshes usually redirect an app\'s traffic to the sidecar transparently, for example with iptables rules; here the Sidecar is handed in explicitly. The usage builds a second OrderService with the Network instead, to show the same code without a sidecar.',
    },
    {
      id: "network",
      label: "Network",
      role: "Cluster network (simulated)",
      kind: "object",
      x: 480,
      y: 200,
      code: "network",
      description:
        "Stands in for the cluster network: it looks up the service named in the request and passes the request to it. It provides the outbound interface too, which is why it can be the Sidecar's upstream or be handed straight to an OrderService. An unknown service name is a programmer error and fails loudly; the example never triggers it.",
    },
    {
      id: "inventory",
      label: "InventoryService",
      role: "Remote service",
      kind: "class",
      x: 700,
      y: 200,
      width: 140,
      code: "inventory",
      description:
        'The service being called. It counts the call first thing, so its counter includes rejected calls. Then it checks, in this order: a missing x-client-identity header gets 401 "no client identity"; a scripted failure, armed for exactly the next call, gets 503 "busy"; anything else gets 200 and "sku-1: 3 in stock". It only checks that the header is present, not who sent it, so this is not real authentication.',
    },
  ],
  relations: [
    {
      id: "send",
      from: "app",
      to: "sidecar",
      type: "calls",
      label: "send",
      description:
        "OrderService hands its GET request to the outbound interface it was given, which is the Sidecar. The final response comes back along the same arrow; the app sees only that, not how many attempts were made.",
      code: "app",
    },
    {
      id: "attempt",
      from: "sidecar",
      to: "network",
      type: "calls",
      label: "attempt + identity",
      description:
        "The Sidecar sends a copy of the request with the x-client-identity header added to its upstream, here the Network. The app's own request is not changed. Each attempt is one more send along this arrow, and a retry follows only a 503 while the attempts made for this request are within max retries.",
      code: "sidecar",
    },
    {
      id: "bypass",
      from: "app",
      to: "network",
      type: "calls",
      label: "bypass (no sidecar)",
      bend: 25,
      description:
        "The usage wires a second OrderService straight to the Network. It is the same app code, but nothing adds an identity header, retries a failure or counts the call, because the Sidecar is not on the path.",
      code: "app",
    },
    {
      id: "deliver",
      from: "network",
      to: "inventory",
      type: "calls",
      label: "deliver",
      description:
        "The Network looks up the service named in the request (inventory) and passes the request to it. The status and body come back along the same arrow.",
      code: "network",
    },
    {
      id: "reload",
      from: "operator",
      to: "sidecar",
      type: "calls",
      label: "reload config",
      description:
        "The operator changes a setting on the running Sidecar: max retries becomes 0 and the Sidecar prints a line. OrderService is not changed, rebuilt or redeployed.",
      code: "sidecar",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "A helper next to each instance",
      description:
        "OrderService sends its outbound calls to a Sidecar that sits next to it, usually in the same pod in a real system, and the Sidecar adds an identity header, retries a 503 and counts requests before the call goes over the network to InventoryService. The Network here stands in for the cluster network. The process boundary is simulated: the app and the Sidecar are objects in one process and the call between them is a method call.",
      highlight: ["operator", "sidecar", "app", "network", "inventory"],
      code: "sidecar",
    },
    {
      title: "First call: identity added, one attempt",
      description:
        "The usage wires the pieces together (the Sidecar is created for service orders with max retries 1) and OrderService checks stock for sku-1. It sends the GET request to the Sidecar, which counts it, adds x-client-identity: orders to a copy and sends the copy through the Network. InventoryService counts the call (calls 1), sees the header and answers 200 with sku-1: 3 in stock. The answer travels back the same way. The app code added no header.",
      highlight: ["app", "send", "sidecar", "attempt", "network", "deliver", "inventory"],
      packets: [
        { relation: "send", label: "GET /stock/sku-1" },
        { relation: "attempt", label: "+ identity", after: 0 },
        { relation: "deliver", label: "GET", after: 1 },
        { relation: "deliver", label: "200", reverse: true, after: 2 },
        { relation: "attempt", label: "200", reverse: true, after: 3 },
        { relation: "send", label: "200", reverse: true, after: 4 },
      ],
      notes: { inventory: "calls 1", sidecar: "requests 1 · attempts 1" },
      code: "sidecar",
    },
    {
      title: "A transient 503 is retried",
      description:
        "The usage arms a scripted failure: exactly the next call to InventoryService will answer 503. OrderService asks again. Attempt 1 reaches InventoryService (calls 2), which answers 503 busy. A 503 within the retry limit (max retries 1) makes the Sidecar send the same copy again. Attempt 2 reaches InventoryService (calls 3) and gets 200. The app sees only the 200; the extra attempt shows up only in the sidecar's counters, which are now requests 2, attempts 3, retries 1. Retrying is safe here only because the call is a GET, and only a 503 is retried.",
      highlight: ["app", "send", "sidecar", "attempt", "network", "deliver", "inventory"],
      packets: [
        { relation: "send", label: "GET /stock/sku-1" },
        { relation: "attempt", label: "attempt 1", after: 0 },
        { relation: "deliver", label: "GET", after: 1 },
        { relation: "deliver", label: "503", reverse: true, after: 2 },
        { relation: "attempt", label: "503", reverse: true, after: 3 },
        { relation: "attempt", label: "attempt 2", after: 4 },
        { relation: "deliver", label: "GET", after: 5 },
        { relation: "deliver", label: "200", reverse: true, after: 6 },
        { relation: "attempt", label: "200", reverse: true, after: 7 },
        { relation: "send", label: "200", reverse: true, after: 8 },
      ],
      notes: { inventory: "calls 3", sidecar: "requests 2 · attempts 3 · retries 1" },
      code: "sidecar",
    },
    {
      title: "The same app code, bypassing the sidecar",
      description:
        "The usage prints a line and builds a second OrderService that is handed the Network instead of the Sidecar. It is the same app code. Nothing adds the identity header, so InventoryService counts the call (calls 4), finds no x-client-identity header and answers 401 no client identity. The Sidecar was not on the path, so its counters stay at requests 2 and attempts 3. Here the 401 comes only from the missing header: it is a stand-in for mutual TLS and a plain header is not secure.",
      highlight: ["app", "bypass", "network", "deliver", "inventory"],
      packets: [
        { relation: "bypass", label: "GET (no header)" },
        { relation: "deliver", label: "GET", after: 0 },
        { relation: "deliver", label: "401", reverse: true, after: 1 },
        { relation: "bypass", label: "401", reverse: true, after: 2 },
      ],
      notes: { inventory: "calls 4" },
      code: "usage",
    },
    {
      title: "Config reload: no change to the app",
      description:
        "The usage plays the operator and reloads the Sidecar's config: max retries becomes 0. The Sidecar prints config reloaded: max retries 0. OrderService is not changed, rebuilt or redeployed; the behaviour of its outbound calls changed anyway, because that behaviour lives in the sidecar.",
      highlight: ["operator", "reload", "sidecar"],
      packets: [{ relation: "reload", label: "max retries 0" }],
      notes: { sidecar: "max retries 0" },
      code: "sidecar",
    },
    {
      title: "The next transient 503 reaches the app",
      description:
        "The usage arms another scripted failure and OrderService asks again, with the same app code as before. The Sidecar makes attempt 1, and InventoryService (calls 5) answers 503 busy. With max retries 0 the attempts made already exceed the limit, so there is no retry and the 503 goes back to the app, which prints 503 busy. The Sidecar counts a failure, because the final status is 400 or above.",
      highlight: ["app", "send", "sidecar", "attempt", "network", "deliver", "inventory"],
      packets: [
        { relation: "send", label: "GET /stock/sku-1" },
        { relation: "attempt", label: "attempt 1", after: 0 },
        { relation: "deliver", label: "GET", after: 1 },
        { relation: "deliver", label: "503", reverse: true, after: 2 },
        { relation: "attempt", label: "503", reverse: true, after: 3 },
        { relation: "send", label: "503", reverse: true, after: 4 },
      ],
      notes: { inventory: "calls 5", sidecar: "failures 1" },
      code: "sidecar",
    },
    {
      title: "Metrics without app code",
      description:
        "The usage prints the sidecar's counters: requests 3, attempts 4, retries 1, failures 1. The Sidecar kept all of them; OrderService has no metrics code. The requests are the three calls that went through it: the first call, the retried call and the last call. The attempts are 1 + 2 + 1. The one retry came from the retried call. The one failure is the final 503; the 401 from the bypass is not counted because that call never reached the Sidecar. InventoryService counted 5 calls: the 4 attempts plus the bypass call.",
      highlight: ["sidecar", "inventory"],
      notes: { sidecar: "requests 3 · attempts 4 · retries 1", inventory: "calls 5" },
      code: "sidecar",
    },
    {
      title: "Summary and costs",
      description:
        "The Sidecar took identity, retries and metrics out of OrderService and made them changeable without changing it. Real sidecars are separate processes or containers deployed with each instance: Envoy in Istio's sidecar mode (Istio also has a sidecar-less ambient mode), linkerd2-proxy in Linkerd and daprd in Dapr. Real meshes also intercept the app's traffic transparently, where here the Sidecar is handed in. The price is an extra process per instance, an extra local hop on each call and more to upgrade and debug. A sidecar that handles only outbound calls, as this one does, is effectively the Ambassador pattern.",
      highlight: [
        "operator",
        "sidecar",
        "app",
        "network",
        "inventory",
        "send",
        "attempt",
        "deliver",
      ],
      code: "usage",
    },
  ],

  // Example code lives in example.ts / example.cs / example.py / example.go next to this file.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
