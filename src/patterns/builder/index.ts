import type { PatternDefinition } from '@/types/pattern'
import { BuilderVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'builder',
  name: 'Builder',
  category: 'creational',
  order: 3,
  summary: 'Construct complex objects step by step, separating construction from representation.',
  intent:
    'Separate the construction of a complex object from its representation, so the same construction process can create different representations.',
  problem:
    'An HTTP request can have a method, headers, query params, a body, a timeout, retries… A single constructor with a dozen optional parameters becomes unreadable, and most combinations are never used together — a "telescoping constructor" nobody wants to call.',
  solution:
    'A Builder exposes small, chainable methods — one per optional piece — each returning `this` so calls can be chained fluently. A final build() assembles everything into an immutable product. An optional Director can encapsulate common recipes (e.g. "a JSON POST request") by calling the builder steps in a fixed order.',
  analogy:
    'Ordering a custom pizza: you add toppings one at a time (cheese, then pepperoni, then olives) and only at the end does the kitchen "build" the actual pizza. You never have to specify every topping up front in one giant order form.',
  whenToUse: [
    'An object needs many optional fields and a giant constructor would be unreadable.',
    'You want the same step-by-step process to produce several different representations.',
    'You want construction code to read like a clear, fluent recipe instead of a flat parameter list.',
  ],
  pros: [
    'Construct objects step by step, deferring steps or running them recursively.',
    'Reuse the same construction code to build different representations of a product.',
    'Isolates complex construction logic from the product’s own business logic.',
  ],
  cons: [
    'Adds extra classes and indirection, which is overkill for simple objects.',
    'The product usually must stay partially-constructable, which can make it harder to enforce invariants until build() is called.',
  ],
  realWorld: [
    'Fetch/Axios request builders and the WHATWG URL / URLSearchParams builder-style APIs',
    'Java’s StringBuilder and Lombok’s @Builder',
    'SQL query builders (Knex, TypeORM QueryBuilder)',
    'UI layout builders that chain .add()/.with() calls before a final .build()',
  ],
  related: ['abstract-factory', 'factory-method', 'composite'],
  participants: [
    {
      id: 'builder',
      label: 'RequestBuilder',
      role: 'Builder',
      kind: 'class',
      x: 400,
      y: 90,
      width: 180,
      description: 'Offers chainable methods — method(), header(), query(), body() — that each set one piece of the request and return `this`. build() produces the final HttpRequest.',
    },
    {
      id: 'request',
      label: 'HttpRequest',
      role: 'Product',
      kind: 'object',
      x: 400,
      y: 250,
      description: 'The finished, immutable object assembled from everything the builder collected: method, url, headers, query and body.',
    },
    {
      id: 'director',
      label: 'RequestDirector',
      role: 'Director',
      kind: 'class',
      x: 130,
      y: 90,
      description: 'Knows common recipes, like "a JSON POST", and drives the builder through the right sequence of calls for that recipe.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 650,
      y: 90,
      description: 'Can either call the director for a common recipe, or chain builder methods itself for a one-off request.',
    },
  ],
  relations: [
    {
      id: 'director-uses',
      from: 'director',
      to: 'builder',
      type: 'calls',
      label: 'drives steps',
      description: 'The director calls a fixed sequence of builder methods to assemble a known recipe, like a JSON POST request.',
      code: 'director',
    },
    {
      id: 'client-uses',
      from: 'client',
      to: 'builder',
      type: 'calls',
      label: 'chains calls',
      description: 'The client can skip the director entirely and chain whatever builder steps it needs for a custom request.',
      bend: 40,
      code: 'usage',
    },
    {
      id: 'builder-creates',
      from: 'builder',
      to: 'request',
      type: 'creates',
      label: 'build()',
      description: 'build() reads everything collected so far and returns one finished HttpRequest.',
      code: 'build',
    },
  ],
  steps: [
    {
      title: 'Start fresh',
      description: 'A new RequestBuilder starts empty — no method, headers, query or body set yet.',
      highlight: ['builder'],
      notes: { builder: 'parts: 0/4' },
      code: 'builder',
    },
    {
      title: 'Chain the pieces',
      description: 'The client calls .method("POST"), then .header(...), then .body(...) — each call sets one part and returns the builder itself for the next call.',
      highlight: ['client', 'client-uses'],
      notes: { builder: 'parts: 3/4' },
      code: 'usage',
    },
    {
      title: 'Or let a Director drive it',
      description: 'For a common shape — "a JSON POST" — RequestDirector.postJson() calls the same builder methods in a fixed, reusable order.',
      highlight: ['director', 'director-uses'],
      packets: [{ relation: 'director-uses', label: 'method()/header()/body()' }],
      notes: { builder: 'parts: 3/4' },
      code: 'director',
    },
    {
      title: 'Build the product',
      description: 'build() assembles everything collected so far into one immutable HttpRequest and returns it.',
      highlight: ['builder', 'builder-creates', 'request'],
      packets: [{ relation: 'builder-creates', label: 'build()' }],
      notes: { request: 'assembled' },
      code: 'build',
    },
    {
      title: 'Same process, different product',
      description: 'A fresh builder with different chained calls (e.g. GET, no body) produces a completely different HttpRequest from the exact same construction process.',
      highlight: ['builder', 'request'],
      notes: { request: 'parts: 2/4' },
      code: 'build',
    },
  ],
  code: `
// [request]
interface HttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  query: Record<string, string>
  body?: string
}
// [/request]

// [builder]
class RequestBuilder {
  private _method = 'GET'
  private _url: string
  private _headers: Record<string, string> = {}
  private _query: Record<string, string> = {}
  private _body?: string

  constructor(url: string) {
    this._url = url
  }

  method(method: string): this {
    this._method = method
    return this
  }

  header(key: string, value: string): this {
    this._headers[key] = value
    return this
  }

  query(key: string, value: string): this {
    this._query[key] = value
    return this
  }

  body(body: string): this {
    this._body = body
    return this
  }

  // [build]
  build(): HttpRequest {
    return {
      method: this._method,
      url: this._url,
      headers: this._headers,
      query: this._query,
      body: this._body,
    }
  }
  // [/build]
}
// [/builder]

// [director]
class RequestDirector {
  // A reusable recipe: a JSON POST request.
  static postJson(url: string, payload: unknown): HttpRequest {
    return new RequestBuilder(url)
      .method('POST')
      .header('Content-Type', 'application/json')
      .body(JSON.stringify(payload))
      .build()
  }
}
// [/director]

// Usage
// [usage]
// One-off request, chained directly:
const search = new RequestBuilder('/api/items').query('q', 'pizza').build()

// Common recipe, via the director:
const create = RequestDirector.postJson('/api/items', { name: 'Margherita' })
// [/usage]
`,
  Visualization: BuilderVisualization,
}
