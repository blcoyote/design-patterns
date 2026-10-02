import type { PatternDefinition } from '@/types/pattern'
import { BuilderVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'builder',
  name: 'Builder',
  category: 'creational',
  order: 3,
  summary: 'Construct complex objects step by step, so the same construction process can yield different representations.',
  intent:
    'Separate the construction of a complex object from its representation, so the same construction process can create different representations.',
  problem:
    'An HTTP request can have a method, headers, query params, a body, a timeout, retries… A single constructor with a dozen optional parameters becomes unreadable, and most combinations are never used together — a "telescoping constructor" nobody wants to call. Worse, sometimes you need the same recipe to produce more than one kind of output — say, both a real request object and the equivalent curl command for debugging.',
  solution:
    'A Builder interface declares the construction steps — one per optional piece. Each ConcreteBuilder implements those steps for its own product: one assembles a real object, another renders a string. A Director knows reusable recipes (e.g. "a JSON POST") and drives any builder it is handed through the same fixed sequence of steps, without knowing which concrete product comes out. The client picks a concrete builder, optionally hands it to the director, and retrieves the finished product with getResult(). The popular "fluent builder" you see in most codebases (Joshua Bloch\'s version) is a simplified variant: one concrete builder, no separate interface and no Director — fine when you only ever need one representation.',
  analogy:
    'A recipe card (the Director) lists the same steps — "knead, top, bake" — regardless of which kitchen follows it. Hand it to a pizzeria (one builder) and you get a pizza; hand the exact same card to a meal-kit packer (another builder) and you get a boxed kit instead. Same process, different finished product.',
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
    'Required parts can only be validated at getResult() time, not at compile time (unless you reach for staged/typestate builders).',
  ],
  realWorld: [
    'java.net.http.HttpRequest.newBuilder() and OkHttp’s Request.Builder — a Builder interface-ish API built into HTTP clients',
    '.NET’s UriBuilder and ASP.NET Core’s WebApplicationBuilder — distinct builder objects with their own Build()',
    'SQL query builders (Knex, TypeORM QueryBuilder)',
    'Lombok’s @Builder annotation — generates the popular single-class "fluent builder" variant, without a separate Director or Builder interface',
  ],
  related: ['abstract-factory', 'factory-method', 'composite'],
  participants: [
    {
      id: 'builder',
      label: 'RequestBuilder',
      role: 'Builder',
      kind: 'interface',
      x: 400,
      y: 60,
      width: 200,
      description: 'Declares the construction steps — setMethod(), setHeader(), setQuery(), setBody() — that every concrete builder must implement.',
    },
    {
      id: 'director',
      label: 'RequestDirector',
      role: 'Director',
      kind: 'class',
      x: 130,
      y: 60,
      description: 'Knows a reusable recipe, "a JSON POST", and drives whichever builder it is handed through that fixed sequence of steps — never seeing the concrete product.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 650,
      y: 60,
      description: 'Creates a concrete builder, optionally hands it to the director for a known recipe, and retrieves the finished product with getResult() — or chains the concrete builder itself for a one-off request.',
    },
    {
      id: 'httpBuilder',
      label: 'HttpRequestBuilder',
      role: 'ConcreteBuilder',
      kind: 'class',
      x: 230,
      y: 210,
      description: 'Implements RequestBuilder; accumulates method/headers/query/body into private fields. getResult() returns a finished HttpRequest object.',
    },
    {
      id: 'curlBuilder',
      label: 'CurlCommandBuilder',
      role: 'ConcreteBuilder',
      kind: 'class',
      x: 570,
      y: 210,
      description: 'Implements the SAME RequestBuilder interface, but getResult() renders everything as a curl command string instead.',
    },
    {
      id: 'request',
      label: 'HttpRequest',
      role: 'Product',
      kind: 'object',
      x: 230,
      y: 360,
      code: 'product',
      description: 'The object representation, assembled by HttpRequestBuilder: method, url, headers, query and body.',
    },
    {
      id: 'curlCommand',
      label: 'curl command',
      role: 'Product',
      kind: 'object',
      x: 570,
      y: 360,
      code: 'curlBuilder',
      description: 'A totally different representation — a shell command string — assembled by CurlCommandBuilder from the exact same director recipe.',
    },
  ],
  relations: [
    {
      id: 'implements-http',
      from: 'httpBuilder',
      to: 'builder',
      type: 'implements',
      label: 'implements',
      description: 'HttpRequestBuilder implements RequestBuilder, exposing the same four construction steps.',
      code: 'httpBuilder',
    },
    {
      id: 'implements-curl',
      from: 'curlBuilder',
      to: 'builder',
      type: 'implements',
      label: 'implements',
      description: 'CurlCommandBuilder implements the same interface, so the director can drive it identically.',
      code: 'curlBuilder',
    },
    {
      id: 'director-uses',
      from: 'director',
      to: 'builder',
      type: 'calls',
      label: 'drives steps',
      description: 'The director calls only the interface\'s part-steps — setMethod/setHeader/setBody — never knowing which concrete builder, or which product, it is driving.',
      code: 'director',
    },
    {
      id: 'client-director',
      from: 'client',
      to: 'director',
      type: 'calls',
      label: 'postJson(builder, …)',
      description: 'The client builds a concrete builder and hands it to the director, which runs the fixed "JSON POST" sequence against it.',
      code: 'usage',
    },
    {
      id: 'client-uses',
      from: 'client',
      to: 'httpBuilder',
      type: 'calls',
      label: 'chains calls',
      description: 'The client can skip the director entirely and chain a concrete builder\'s own fluent methods for a one-off request.',
      bend: 40,
      code: 'usage',
    },
    {
      id: 'http-creates',
      from: 'httpBuilder',
      to: 'request',
      type: 'creates',
      label: 'getResult()',
      description: 'Once the construction steps have run, getResult() returns the finished HttpRequest object.',
      code: 'httpBuild',
    },
    {
      id: 'curl-creates',
      from: 'curlBuilder',
      to: 'curlCommand',
      type: 'creates',
      label: 'getResult()',
      description: 'The exact same sequence of steps, run against CurlCommandBuilder, yields a curl command string instead.',
      code: 'curlBuild',
    },
  ],
  steps: [
    {
      title: 'Start fresh',
      description: 'Two concrete builders — HttpRequestBuilder and CurlCommandBuilder — both implement RequestBuilder and start out empty.',
      highlight: ['builder', 'httpBuilder', 'curlBuilder'],
      notes: { httpBuilder: 'parts: 0/4', curlBuilder: 'parts: 0/4' },
      code: 'builder',
    },
    {
      title: 'Director drives the HTTP builder',
      description: 'The client hands HttpRequestBuilder to RequestDirector.postJson(), which calls setMethod("POST"), setHeader(...) and setBody(...) on it.',
      highlight: ['client', 'director', 'director-uses', 'httpBuilder'],
      packets: [
        { relation: 'client-director', label: 'postJson(builder, payload)' },
        { relation: 'director-uses', label: 'setMethod()/setHeader()/setBody()' },
      ],
      notes: { httpBuilder: 'parts: 3/4' },
      code: 'director',
    },
    {
      title: 'Retrieve the result',
      description: 'The client calls getResult() on HttpRequestBuilder to pull out the finished HttpRequest object.',
      highlight: ['httpBuilder', 'http-creates', 'request'],
      packets: [{ relation: 'http-creates', label: 'getResult()' }],
      notes: { request: 'assembled' },
      code: 'httpBuild',
    },
    {
      title: 'Same recipe, different builder',
      description: 'Handing the exact same director recipe a CurlCommandBuilder instead drives the identical setMethod/setHeader/setBody steps — but against a builder that renders text, not an object.',
      highlight: ['director', 'director-uses', 'curlBuilder'],
      packets: [{ relation: 'director-uses', label: 'setMethod()/setHeader()/setBody()' }],
      notes: { curlBuilder: 'parts: 3/4' },
      code: 'director',
    },
    {
      title: 'Same process, different product',
      description: 'getResult() on CurlCommandBuilder returns a curl command string — a completely different representation, built by the exact same construction steps.',
      highlight: ['curlBuilder', 'curl-creates', 'curlCommand'],
      packets: [{ relation: 'curl-creates', label: 'getResult()' }],
      notes: { curlCommand: 'rendered' },
      code: 'curlBuild',
    },
  ],
  code: `
// [product]
interface HttpRequest {
  readonly method: string
  readonly url: string
  readonly headers: Record<string, string>
  readonly query: Record<string, string>
  readonly body?: string
}
// [/product]

// [builder]
// The Builder: an interface so a Director can drive ANY concrete builder
// through the exact same construction steps.
interface RequestBuilder {
  setMethod(method: string): this
  setHeader(key: string, value: string): this
  setQuery(key: string, value: string): this
  setBody(body: string): this
}
// [/builder]

// [httpBuilder]
// ConcreteBuilder #1: assembles a real HttpRequest object.
class HttpRequestBuilder implements RequestBuilder {
  private _method = 'GET'
  private readonly _headers: Record<string, string> = {}
  private readonly _query: Record<string, string> = {}
  private _body?: string

  constructor(private readonly url: string) {}

  setMethod(method: string): this {
    this._method = method
    return this
  }

  setHeader(key: string, value: string): this {
    this._headers[key] = value
    return this
  }

  setQuery(key: string, value: string): this {
    this._query[key] = value
    return this
  }

  setBody(body: string): this {
    this._body = body
    return this
  }

  // [httpBuild]
  getResult(): HttpRequest {
    return {
      method: this._method,
      url: this.url,
      headers: { ...this._headers },
      query: { ...this._query },
      body: this._body,
    }
  }
  // [/httpBuild]
}
// [/httpBuilder]

// [curlBuilder]
// ConcreteBuilder #2: the exact same steps, rendered as a curl command string.
class CurlCommandBuilder implements RequestBuilder {
  private _method = 'GET'
  private readonly _headerFlags: string[] = []
  private readonly _queryParts: string[] = []
  private _body?: string

  constructor(private readonly url: string) {}

  setMethod(method: string): this {
    this._method = method
    return this
  }

  setHeader(key: string, value: string): this {
    this._headerFlags.push(\`-H '\${key}: \${value}'\`)
    return this
  }

  setQuery(key: string, value: string): this {
    this._queryParts.push(\`\${key}=\${encodeURIComponent(value)}\`)
    return this
  }

  setBody(body: string): this {
    this._body = body
    return this
  }

  // [curlBuild]
  getResult(): string {
    const query = this._queryParts.length > 0 ? \`?\${this._queryParts.join('&')}\` : ''
    const parts = [\`curl -X \${this._method}\`, ...this._headerFlags]
    if (this._body) parts.push(\`-d '\${this._body}'\`)
    parts.push(\`'\${this.url}\${query}'\`)
    return parts.join(' ')
  }
  // [/curlBuild]
}
// [/curlBuilder]

// [director]
class RequestDirector {
  // A reusable recipe: a JSON POST. It only knows the Builder interface, so
  // the SAME steps can drive an HttpRequestBuilder or a CurlCommandBuilder.
  static postJson(builder: RequestBuilder, payload: unknown): void {
    builder.setMethod('POST')
    builder.setHeader('Content-Type', 'application/json')
    builder.setBody(JSON.stringify(payload))
  }
}
// [/director]

// Usage
// [usage]
// Same director recipe, two different concrete builders -> two representations:
const httpBuilder = new HttpRequestBuilder('/api/items')
RequestDirector.postJson(httpBuilder, { name: 'Margherita' })
const request: HttpRequest = httpBuilder.getResult()

const curlBuilder = new CurlCommandBuilder('/api/items')
RequestDirector.postJson(curlBuilder, { name: 'Margherita' })
const command: string = curlBuilder.getResult()

// Skipping the director: chain a concrete builder directly for a one-off request.
const search = new HttpRequestBuilder('/api/items').setQuery('q', 'pizza').getResult()
// [/usage]
`,
  Visualization: BuilderVisualization,
}
