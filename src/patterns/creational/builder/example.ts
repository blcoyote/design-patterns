// [product]
interface HttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly query: Record<string, string>;
  readonly body?: string;
}
// [/product]

// [builder]
// The Builder: an interface so a Director can drive ANY concrete builder
// through the exact same construction steps.
interface RequestBuilder {
  setMethod(method: string): this;
  setHeader(key: string, value: string): this;
  setQuery(key: string, value: string): this;
  setBody(body: string): this;
}
// [/builder]

// [httpBuilder]
// ConcreteBuilder #1: assembles a real HttpRequest object.
class HttpRequestBuilder implements RequestBuilder {
  private _method = "GET";
  private readonly _headers: Record<string, string> = {};
  private readonly _query: Record<string, string> = {};
  private _body?: string;

  constructor(private readonly url: string) {}

  setMethod(method: string): this {
    this._method = method;
    return this;
  }

  setHeader(key: string, value: string): this {
    this._headers[key] = value;
    return this;
  }

  setQuery(key: string, value: string): this {
    this._query[key] = value;
    return this;
  }

  setBody(body: string): this {
    this._body = body;
    return this;
  }

  // [httpBuild]
  getResult(): HttpRequest {
    return {
      method: this._method,
      url: this.url,
      headers: { ...this._headers },
      query: { ...this._query },
      body: this._body,
    };
  }
  // [/httpBuild]
}
// [/httpBuilder]

// [curlBuilder]
// ConcreteBuilder #2: the exact same steps, rendered as a curl command string.
class CurlCommandBuilder implements RequestBuilder {
  private _method = "GET";
  private readonly _headerFlags: string[] = [];
  private readonly _queryParts: string[] = [];
  private _body?: string;

  constructor(private readonly url: string) {}

  setMethod(method: string): this {
    this._method = method;
    return this;
  }

  setHeader(key: string, value: string): this {
    this._headerFlags.push(`-H '${key}: ${value}'`);
    return this;
  }

  setQuery(key: string, value: string): this {
    this._queryParts.push(`${key}=${encodeURIComponent(value)}`);
    return this;
  }

  setBody(body: string): this {
    this._body = body;
    return this;
  }

  // [curlBuild]
  getResult(): string {
    const query = this._queryParts.length > 0 ? `?${this._queryParts.join("&")}` : "";
    const parts = [`curl -X ${this._method}`, ...this._headerFlags];
    if (this._body) parts.push(`-d '${this._body}'`);
    parts.push(`'${this.url}${query}'`);
    return parts.join(" ");
  }
  // [/curlBuild]
}
// [/curlBuilder]

// [director]
class RequestDirector {
  // A reusable recipe: a JSON POST. It only knows the Builder interface, so
  // the SAME steps can drive an HttpRequestBuilder or a CurlCommandBuilder.
  static postJson(builder: RequestBuilder, payload: unknown): void {
    builder.setMethod("POST");
    builder.setHeader("Content-Type", "application/json");
    builder.setBody(JSON.stringify(payload));
  }
}
// [/director]

// Usage
// [usage]
// Same director recipe, two different concrete builders -> two representations:
const httpBuilder = new HttpRequestBuilder("/api/items");
RequestDirector.postJson(httpBuilder, { name: "Margherita" });
const request: HttpRequest = httpBuilder.getResult();

const curlBuilder = new CurlCommandBuilder("/api/items");
RequestDirector.postJson(curlBuilder, { name: "Margherita" });
const command: string = curlBuilder.getResult();

// Skipping the director: chain a concrete builder directly for a one-off request.
const search = new HttpRequestBuilder("/api/items").setQuery("q", "pizza").getResult();
// [/usage]
