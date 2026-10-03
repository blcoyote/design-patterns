import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import { BuilderVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "builder",
  name: "Builder",
  category: "creational",
  order: 3,
  summary:
    "Construct complex objects step by step, so the same construction process can yield different representations.",
  intent:
    'Build a complex object step by step, so the same process can produce different results and the constructor stays readable.',
  problem:
    'An HTTP request can have a method, headers, query params, a body, a timeout, retries and more. One constructor with a dozen optional parameters is hard to read, and most combinations are never used together. This is the "telescoping constructor" nobody wants to call. Sometimes you also need the same recipe to produce more than one kind of output, for example a real request object and the equivalent curl command for debugging.',
  solution:
    'A Builder interface declares the construction steps, one per optional piece. Each ConcreteBuilder implements those steps for its own product: one assembles a real object, another renders a string. A Director holds reusable recipes (e.g. "a JSON POST") and runs any builder it is handed through the same fixed steps, without knowing which product comes out. The client picks a concrete builder, optionally hands it to the director, and collects the finished product with getResult(). The popular "fluent builder" you see in most codebases (Joshua Bloch\'s version) is a simplified variant: one concrete builder, no Builder interface and no Director. That is fine when you only ever need one kind of output.',
  analogy:
    'A recipe card (the Director) lists the same steps, "knead, top, bake", no matter which kitchen follows it. Hand it to a pizzeria (one builder) and you get a pizza. Hand the exact same card to a meal-kit packer (another builder) and you get a boxed kit. Same process, different finished product.',
  whenToUse: [
    "An object has many optional fields and one giant constructor would be unreadable.",
    "You want the same step-by-step process to produce several different representations.",
    "You want construction code to read like a clear, fluent recipe instead of a flat list of parameters.",
  ],
  pros: [
    "You build objects step by step, and can postpone steps or run them recursively.",
    "The same construction code can build different representations of a product.",
    "Complex construction logic stays out of the product's own business logic.",
  ],
  cons: [
    "It adds extra classes and indirection, which is overkill for simple objects.",
    "Required parts can only be checked when you call getResult(), not at compile time (unless you use staged or typestate builders).",
  ],
  realWorld: [
    "java.net.http.HttpRequest.newBuilder() and OkHttp's Request.Builder, builders built into HTTP clients",
    "ASP.NET Core's WebApplicationBuilder, a separate builder object with its own Build() method",
    "SQL query builders (Knex, TypeORM QueryBuilder)",
    'Lombok\'s @Builder annotation, which generates the popular single-class "fluent builder" variant without a separate Director or Builder interface',
  ],
  related: ["abstract-factory", "factory-method", "composite"],
  participants: [
    {
      id: "builder",
      label: "RequestBuilder",
      role: "Builder",
      kind: "interface",
      x: 400,
      y: 60,
      width: 200,
      description:
        "Declares the construction steps — setMethod(), setHeader(), setQuery(), setBody() — that every concrete builder must implement.",
    },
    {
      id: "director",
      label: "RequestDirector",
      role: "Director",
      kind: "class",
      x: 130,
      y: 60,
      description:
        'Knows a reusable recipe, "a JSON POST", and drives whichever builder it is handed through that fixed sequence of steps — never seeing the concrete product.',
    },
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 650,
      y: 60,
      description:
        "Creates a concrete builder, optionally hands it to the director for a known recipe, and retrieves the finished product with getResult() — or chains the concrete builder itself for a one-off request.",
    },
    {
      id: "httpBuilder",
      label: "HttpRequestBuilder",
      role: "ConcreteBuilder",
      kind: "class",
      x: 230,
      y: 210,
      description:
        "Implements RequestBuilder; accumulates method/headers/query/body into private fields. getResult() returns a finished HttpRequest object.",
    },
    {
      id: "curlBuilder",
      label: "CurlCommandBuilder",
      role: "ConcreteBuilder",
      kind: "class",
      x: 570,
      y: 210,
      description:
        "Implements the SAME RequestBuilder interface, but getResult() renders everything as a curl command string instead.",
    },
    {
      id: "request",
      label: "HttpRequest",
      role: "Product",
      kind: "object",
      x: 230,
      y: 360,
      code: "product",
      description:
        "The object representation, assembled by HttpRequestBuilder: method, url, headers, query and body.",
    },
    {
      id: "curlCommand",
      label: "curl command",
      role: "Product",
      kind: "object",
      x: 570,
      y: 360,
      code: "curlBuilder",
      description:
        "A totally different representation — a shell command string — assembled by CurlCommandBuilder from the exact same director recipe.",
    },
  ],
  relations: [
    {
      id: "implements-http",
      from: "httpBuilder",
      to: "builder",
      type: "implements",
      label: "implements",
      description:
        "HttpRequestBuilder implements RequestBuilder, exposing the same four construction steps.",
      code: "httpBuilder",
    },
    {
      id: "implements-curl",
      from: "curlBuilder",
      to: "builder",
      type: "implements",
      label: "implements",
      description:
        "CurlCommandBuilder implements the same interface, so the director can drive it identically.",
      code: "curlBuilder",
    },
    {
      id: "director-uses",
      from: "director",
      to: "builder",
      type: "calls",
      label: "drives steps",
      description:
        "The director calls only the interface's part-steps — setMethod/setHeader/setBody — never knowing which concrete builder, or which product, it is driving.",
      code: "director",
    },
    {
      id: "client-director",
      from: "client",
      to: "director",
      type: "calls",
      label: "postJson(builder, …)",
      description:
        'The client builds a concrete builder and hands it to the director, which runs the fixed "JSON POST" sequence against it.',
      code: "usage",
    },
    {
      id: "client-uses",
      from: "client",
      to: "httpBuilder",
      type: "calls",
      label: "chains calls",
      description:
        "The client can skip the director entirely and chain a concrete builder's own fluent methods for a one-off request.",
      bend: 40,
      code: "usage",
    },
    {
      id: "http-creates",
      from: "httpBuilder",
      to: "request",
      type: "creates",
      label: "getResult()",
      description:
        "Once the construction steps have run, getResult() returns the finished HttpRequest object.",
      code: "httpBuild",
    },
    {
      id: "curl-creates",
      from: "curlBuilder",
      to: "curlCommand",
      type: "creates",
      label: "getResult()",
      description:
        "The exact same sequence of steps, run against CurlCommandBuilder, yields a curl command string instead.",
      code: "curlBuild",
    },
  ],
  steps: [
    {
      title: "Start fresh",
      description:
        "Two concrete builders — HttpRequestBuilder and CurlCommandBuilder — both implement RequestBuilder and start out empty.",
      highlight: ["builder", "httpBuilder", "curlBuilder"],
      notes: { httpBuilder: "parts: 0/4", curlBuilder: "parts: 0/4" },
      code: "builder",
    },
    {
      title: "Director drives the HTTP builder",
      description:
        'The client hands HttpRequestBuilder to RequestDirector.postJson(), which calls setMethod("POST"), setHeader(...) and setBody(...) on it.',
      highlight: ["client", "director", "director-uses", "httpBuilder"],
      packets: [
        { relation: "client-director", label: "postJson(builder, payload)" },
        {
          relation: "director-uses",
          label: "setMethod()/setHeader()/setBody()",
          after: 0,
        },
      ],
      notes: { httpBuilder: "parts: 3/4" },
      code: "director",
    },
    {
      title: "Retrieve the result",
      description:
        "The client calls getResult() on HttpRequestBuilder to pull out the finished HttpRequest object.",
      highlight: ["httpBuilder", "http-creates", "request"],
      packets: [{ relation: "http-creates", label: "getResult()" }],
      notes: { request: "assembled" },
      code: "httpBuild",
    },
    {
      title: "Same recipe, different builder",
      description:
        "Handing the exact same director recipe a CurlCommandBuilder instead drives the identical setMethod/setHeader/setBody steps — but against a builder that renders text, not an object.",
      highlight: ["director", "director-uses", "curlBuilder"],
      packets: [
        {
          relation: "director-uses",
          label: "setMethod()/setHeader()/setBody()",
        },
      ],
      notes: { curlBuilder: "parts: 3/4" },
      code: "director",
    },
    {
      title: "Same process, different product",
      description:
        "getResult() on CurlCommandBuilder returns a curl command string — a completely different representation, built by the exact same construction steps.",
      highlight: ["curlBuilder", "curl-creates", "curlCommand"],
      packets: [{ relation: "curl-creates", label: "getResult()" }],
      notes: { curlCommand: "rendered" },
      code: "curlBuild",
    },
  ],
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  Visualization: BuilderVisualization,
};
