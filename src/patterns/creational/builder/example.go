package main

import (
	"encoding/json"
	"net/url"
	"strings"
)

// [product]
type HttpRequest struct {
	Method  string
	Url     string
	Headers map[string]string
	Query   map[string]string
	Body    *string // nil means "no body" (optional, like body? in TypeScript)
}

// [/product]

// [builder]
// The Builder: an interface so a Director can drive ANY concrete builder
// through the exact same construction steps. Go has no "this" return type,
// so each step returns the RequestBuilder interface to allow chaining.
type RequestBuilder interface {
	SetMethod(method string) RequestBuilder
	SetHeader(key, value string) RequestBuilder
	SetQuery(key, value string) RequestBuilder
	SetBody(body string) RequestBuilder
}

// [/builder]

// [httpBuilder]
// ConcreteBuilder #1: assembles a real HttpRequest object.
type HttpRequestBuilder struct {
	url     string
	method  string
	headers map[string]string
	query   map[string]string
	body    *string
}

func NewHttpRequestBuilder(url string) *HttpRequestBuilder {
	return &HttpRequestBuilder{
		url:     url,
		method:  "GET",
		headers: map[string]string{},
		query:   map[string]string{},
	}
}

func (b *HttpRequestBuilder) SetMethod(method string) RequestBuilder {
	b.method = method
	return b
}

func (b *HttpRequestBuilder) SetHeader(key, value string) RequestBuilder {
	b.headers[key] = value
	return b
}

func (b *HttpRequestBuilder) SetQuery(key, value string) RequestBuilder {
	b.query[key] = value
	return b
}

func (b *HttpRequestBuilder) SetBody(body string) RequestBuilder {
	b.body = &body
	return b
}

// [httpBuild]
func (b *HttpRequestBuilder) GetResult() HttpRequest {
	headers := map[string]string{}
	for k, v := range b.headers {
		headers[k] = v
	}
	query := map[string]string{}
	for k, v := range b.query {
		query[k] = v
	}
	return HttpRequest{
		Method:  b.method,
		Url:     b.url,
		Headers: headers,
		Query:   query,
		Body:    b.body,
	}
}

// [/httpBuild]
// [/httpBuilder]

// [curlBuilder]
// ConcreteBuilder #2: the exact same steps, rendered as a curl command string.
type CurlCommandBuilder struct {
	url         string
	method      string
	headerFlags []string
	queryParts  []string
	body        string
}

func NewCurlCommandBuilder(url string) *CurlCommandBuilder {
	return &CurlCommandBuilder{url: url, method: "GET"}
}

func (b *CurlCommandBuilder) SetMethod(method string) RequestBuilder {
	b.method = method
	return b
}

func (b *CurlCommandBuilder) SetHeader(key, value string) RequestBuilder {
	b.headerFlags = append(b.headerFlags, "-H '"+key+": "+value+"'")
	return b
}

func (b *CurlCommandBuilder) SetQuery(key, value string) RequestBuilder {
	b.queryParts = append(b.queryParts, key+"="+encodeURIComponent(value))
	return b
}

func (b *CurlCommandBuilder) SetBody(body string) RequestBuilder {
	b.body = body
	return b
}

// [curlBuild]
func (b *CurlCommandBuilder) GetResult() string {
	query := ""
	if len(b.queryParts) > 0 {
		query = "?" + strings.Join(b.queryParts, "&")
	}
	parts := append([]string{"curl -X " + b.method}, b.headerFlags...)
	if b.body != "" {
		parts = append(parts, "-d '"+b.body+"'")
	}
	parts = append(parts, "'"+b.url+query+"'")
	return strings.Join(parts, " ")
}

// [/curlBuild]
// [/curlBuilder]

// encodeURIComponent escapes exactly what JS encodeURIComponent does.
func encodeURIComponent(s string) string {
	escaped := strings.ReplaceAll(url.QueryEscape(s), "+", "%20")
	return strings.NewReplacer("%21", "!", "%27", "'", "%28", "(", "%29", ")", "%2A", "*").Replace(escaped)
}

// [director]
type RequestDirector struct{}

// A reusable recipe: a JSON POST. It only knows the Builder interface, so
// the SAME steps can drive an HttpRequestBuilder or a CurlCommandBuilder.
func (RequestDirector) PostJson(builder RequestBuilder, payload any) {
	builder.SetMethod("POST")
	builder.SetHeader("Content-Type", "application/json")
	data, err := json.Marshal(payload) // compact, like JSON.stringify
	if err != nil {
		panic(err)
	}
	builder.SetBody(string(data))
}

// [/director]

// Usage
// [usage]
func main() {
	director := RequestDirector{}

	// Same director recipe, two different concrete builders -> two representations:
	httpBuilder := NewHttpRequestBuilder("/api/items")
	director.PostJson(httpBuilder, map[string]string{"name": "Margherita"})
	request := httpBuilder.GetResult()

	curlBuilder := NewCurlCommandBuilder("/api/items")
	director.PostJson(curlBuilder, map[string]string{"name": "Margherita"})
	command := curlBuilder.GetResult()

	// Skipping the director: chain a concrete builder directly for a one-off request.
	// (The chain returns the RequestBuilder interface, so we assert back to the
	// concrete type to call GetResult.)
	search := NewHttpRequestBuilder("/api/items").SetQuery("q", "pizza").(*HttpRequestBuilder).GetResult()

	// Like the other tabs, this prints nothing; these only keep Go's unused-variable check happy.
	_, _, _ = request, command, search
}

// [/usage]
