using System.Text.Json;

// Usage
// [usage]
// Same director recipe, two different concrete builders -> two representations:
var httpBuilder = new HttpRequestBuilder("/api/items");
RequestDirector.PostJson(httpBuilder, new { name = "Margherita" });
IHttpRequest request = httpBuilder.GetResult();

var curlBuilder = new CurlCommandBuilder("/api/items");
RequestDirector.PostJson(curlBuilder, new { name = "Margherita" });
string command = curlBuilder.GetResult();

// Skipping the director: chain a concrete builder directly for a one-off request.
var search = new HttpRequestBuilder("/api/items").SetQuery("q", "pizza").GetResult();
// [/usage]

// [product]
interface IHttpRequest
{
    string Method { get; }
    string Url { get; }
    IReadOnlyDictionary<string, string> Headers { get; }
    IReadOnlyDictionary<string, string> Query { get; }
    string? Body { get; }
}
// [/product]

// [builder]
// The Builder: an interface so a Director can drive ANY concrete builder
// through the exact same construction steps.
interface IRequestBuilder
{
    IRequestBuilder SetMethod(string method);
    IRequestBuilder SetHeader(string key, string value);
    IRequestBuilder SetQuery(string key, string value);
    IRequestBuilder SetBody(string body);
}
// [/builder]

// [httpBuilder]
// ConcreteBuilder #1: assembles a real HttpRequest object.
class HttpRequestBuilder(string url) : IRequestBuilder
{
    private string _method = "GET";
    private readonly Dictionary<string, string> _headers = new();
    private readonly Dictionary<string, string> _query = new();
    private string? _body;

    // Public methods return the concrete type so calls can keep chaining
    // without a cast; the interface is still satisfied via the explicit
    // implementations below.
    public HttpRequestBuilder SetMethod(string method)
    {
        _method = method;
        return this;
    }

    public HttpRequestBuilder SetHeader(string key, string value)
    {
        _headers[key] = value;
        return this;
    }

    public HttpRequestBuilder SetQuery(string key, string value)
    {
        _query[key] = value;
        return this;
    }

    public HttpRequestBuilder SetBody(string body)
    {
        _body = body;
        return this;
    }

    IRequestBuilder IRequestBuilder.SetMethod(string method) => SetMethod(method);
    IRequestBuilder IRequestBuilder.SetHeader(string key, string value) => SetHeader(key, value);
    IRequestBuilder IRequestBuilder.SetQuery(string key, string value) => SetQuery(key, value);
    IRequestBuilder IRequestBuilder.SetBody(string body) => SetBody(body);

    // [httpBuild]
    public HttpRequest GetResult() => new(_method, url, new Dictionary<string, string>(_headers), new Dictionary<string, string>(_query), _body);
    // [/httpBuild]
}

record HttpRequest(string Method, string Url, IReadOnlyDictionary<string, string> Headers, IReadOnlyDictionary<string, string> Query, string? Body) : IHttpRequest;
// [/httpBuilder]

// [curlBuilder]
// ConcreteBuilder #2: the exact same steps, rendered as a curl command string.
class CurlCommandBuilder(string url) : IRequestBuilder
{
    private string _method = "GET";
    private readonly List<string> _headerFlags = [];
    private readonly List<string> _queryParts = [];
    private string? _body;

    public CurlCommandBuilder SetMethod(string method)
    {
        _method = method;
        return this;
    }

    public CurlCommandBuilder SetHeader(string key, string value)
    {
        _headerFlags.Add($"-H '{key}: {value}'");
        return this;
    }

    public CurlCommandBuilder SetQuery(string key, string value)
    {
        _queryParts.Add($"{key}={Uri.EscapeDataString(value)}");
        return this;
    }

    public CurlCommandBuilder SetBody(string body)
    {
        _body = body;
        return this;
    }

    IRequestBuilder IRequestBuilder.SetMethod(string method) => SetMethod(method);
    IRequestBuilder IRequestBuilder.SetHeader(string key, string value) => SetHeader(key, value);
    IRequestBuilder IRequestBuilder.SetQuery(string key, string value) => SetQuery(key, value);
    IRequestBuilder IRequestBuilder.SetBody(string body) => SetBody(body);

    // [curlBuild]
    public string GetResult()
    {
        var query = _queryParts.Count > 0 ? $"?{string.Join("&", _queryParts)}" : "";
        var parts = new List<string> { $"curl -X {_method}" };
        parts.AddRange(_headerFlags);
        if (!string.IsNullOrEmpty(_body)) parts.Add($"-d '{_body}'");
        parts.Add($"'{url}{query}'");
        return string.Join(" ", parts);
    }
    // [/curlBuild]
}
// [/curlBuilder]

// [director]
static class RequestDirector
{
    // A reusable recipe: a JSON POST. It only knows the Builder interface, so
    // the SAME steps can drive an HttpRequestBuilder or a CurlCommandBuilder.
    public static void PostJson(IRequestBuilder builder, object payload)
    {
        builder.SetMethod("POST");
        builder.SetHeader("Content-Type", "application/json");
        builder.SetBody(JsonSerializer.Serialize(payload));
    }
}
// [/director]
