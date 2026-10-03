package main

import (
	"fmt"
	"time"
)

type HttpRequest struct {
	Path     string
	ClientID string
	Token    string // empty string means "no token", like TS's undefined
	Body     any    // nil means "no body"
}

type HttpResponse struct {
	Status int
	Body   string
}

// String makes Println print the same text as the Python dataclass repr.
func (r HttpResponse) String() string {
	return fmt.Sprintf("HttpResponse(status=%d, body='%s')", r.Status, r.Body)
}

// [handler]
// Go has no abstract classes: Handler is the interface the client programs
// against, and BaseHandler supplies the shared next-pointer and default
// forwarding that concrete handlers get by embedding it (embedding stands in
// for inheritance).
type Handler interface {
	SetNext(handler Handler) Handler
	Handle(req HttpRequest) HttpResponse
}

type BaseHandler struct {
	next Handler
}

func (b *BaseHandler) SetNext(handler Handler) Handler {
	b.next = handler
	return handler
}

func (b *BaseHandler) Handle(req HttpRequest) HttpResponse {
	if b.next != nil {
		return b.next.Handle(req)
	}
	return HttpResponse{404, "No handler matched"}
}

// [/handler]

// [authHandler]
type AuthHandler struct {
	BaseHandler
}

// [auth]
func (h *AuthHandler) Handle(req HttpRequest) HttpResponse {
	if req.Token == "" || req.Token == "expired" {
		return HttpResponse{401, "Unauthorized"}
	}
	return h.BaseHandler.Handle(req) // not my problem — pass it on
}

// [/auth]
// [/authHandler]

type rateWindow struct {
	windowStart int64
	count       int
}

// [rateLimitHandler]
const (
	windowMs = 60_000
	limit    = 100
)

type RateLimitHandler struct {
	BaseHandler
	// Each client gets its own fixed window — one client going over the cap
	// never affects any other client's count.
	windows map[string]*rateWindow
}

func NewRateLimitHandler() *RateLimitHandler {
	return &RateLimitHandler{windows: map[string]*rateWindow{}}
}

// [rateLimit]
func (h *RateLimitHandler) Handle(req HttpRequest) HttpResponse {
	now := time.Now().UnixMilli()
	window, ok := h.windows[req.ClientID]
	if !ok || now-window.windowStart >= windowMs {
		window = &rateWindow{windowStart: now, count: 0}
		h.windows[req.ClientID] = window
	}
	window.count++
	if window.count > limit {
		return HttpResponse{429, "Too Many Requests"}
	}
	return h.BaseHandler.Handle(req)
}

// [/rateLimit]
// [/rateLimitHandler]

// [validationHandler]
type ValidationHandler struct {
	BaseHandler
}

// [validation]
func (h *ValidationHandler) Handle(req HttpRequest) HttpResponse {
	if req.Body != nil {
		switch req.Body.(type) {
		case string, int, float64, bool: // a primitive, not an object
			return HttpResponse{422, "Invalid payload"}
		}
	}
	return h.BaseHandler.Handle(req) // no body to check, or it already looks fine
}

// [/validation]
// [/validationHandler]

// [controller]
type Controller struct {
	BaseHandler
}

func (c *Controller) Handle(req HttpRequest) HttpResponse {
	// The terminal link: it never calls next, it just answers.
	return HttpResponse{200, "handled " + req.Path}
}

// [/controller]

func main() {
	// [entry]
	chain := &AuthHandler{}
	chain.SetNext(NewRateLimitHandler()).SetNext(&ValidationHandler{}).SetNext(&Controller{})

	fmt.Println(chain.Handle(HttpRequest{Path: "/orders/42", ClientID: "client-1", Token: "abc123"}))  // status=200, body='handled /orders/42'
	fmt.Println(chain.Handle(HttpRequest{Path: "/orders/42", ClientID: "client-1", Token: "expired"})) // status=401, ... — stops at AuthHandler
	// [/entry]
}
