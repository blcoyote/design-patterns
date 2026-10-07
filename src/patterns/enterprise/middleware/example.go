package main

import "fmt"

type Request struct {
	Path  string
	Token string // empty means no token
}

type Response struct {
	Status int
}

type Handler func(req Request) Response

// A middleware receives the request and the rest of the pipeline as next.
type Middleware func(req Request, next Handler) Response

// [pipeline]
// Wraps the handler in the middlewares from last to first, so the first one in
// the list is the outermost: it sees the request first and the response last.
func Pipeline(middlewares []Middleware, handler Handler) Handler {
	result := handler
	for i := len(middlewares) - 1; i >= 0; i-- {
		middleware, next := middlewares[i], result
		result = func(req Request) Response { return middleware(req, next) }
	}
	return result
}

// [/pipeline]

// [logging]
func Logging(req Request, next Handler) Response {
	fmt.Printf("log: -> %s\n", req.Path)
	res := next(req)
	// [logAfter]
	// Code after next() runs on the way back out, once the response exists.
	fmt.Printf("log: <- %d\n", res.Status)
	// [/logAfter]
	return res
}

// [/logging]

// [auth]
func Auth(req Request, next Handler) Response {
	// [authReject]
	// Short-circuit: answer here and never call next(), so nothing deeper runs.
	if req.Token == "" {
		fmt.Println("auth: no token, rejected")
		return Response{401}
	}
	// [/authReject]
	fmt.Println("auth: token accepted")
	return next(req)
}

// [/auth]

// [cache]
// Keyed by path only, so it must sit behind auth: it does not know who is asking.
func MakeCache() Middleware {
	stored := map[string]Response{}
	return func(req Request, next Handler) Response {
		// [cacheHit]
		if hit, ok := stored[req.Path]; ok {
			fmt.Printf("cache: hit %s\n", req.Path)
			return hit
		}
		// [/cacheHit]
		fmt.Printf("cache: miss %s\n", req.Path)
		res := next(req)
		if res.Status == 200 {
			stored[req.Path] = res
			fmt.Printf("cache: stored %s\n", req.Path)
		}
		return res
	}
}

// [/cache]

// [handler]
func BuildReport(req Request) Response {
	fmt.Printf("handler: building %s\n", req.Path)
	return Response{200}
}

// [/handler]

func send(app Handler, token string) {
	res := app(Request{"/report", token})
	fmt.Printf("=> %d\n", res.Status)
}

func main() {
	// [client]
	app := Pipeline([]Middleware{Logging, Auth, MakeCache()}, BuildReport)

	send(app, "t-1") // first request: every middleware runs, the handler builds the report
	// log: -> /report
	// auth: token accepted
	// cache: miss /report
	// handler: building /report
	// cache: stored /report
	// log: <- 200
	// => 200

	send(app, "t-1") // second request: the cache answers, so the handler never runs
	// log: -> /report
	// auth: token accepted
	// cache: hit /report
	// log: <- 200
	// => 200

	send(app, "") // no token: auth rejects, so the cache and handler never run
	// log: -> /report
	// auth: no token, rejected
	// log: <- 401
	// => 401

	// [reorder]
	// The same pieces in a different order: the cache now runs before auth.
	unsafe := Pipeline([]Middleware{Logging, MakeCache(), Auth}, BuildReport)
	// [/reorder]

	send(unsafe, "t-1") // a signed-in request warms the cache
	// log: -> /report
	// cache: miss /report
	// auth: token accepted
	// handler: building /report
	// cache: stored /report
	// log: <- 200
	// => 200

	send(unsafe, "") // an anonymous request is answered from the cache: auth never ran
	// log: -> /report
	// cache: hit /report
	// log: <- 200
	// => 200
	// [/client]
}
