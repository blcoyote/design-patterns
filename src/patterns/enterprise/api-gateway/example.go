package main

import (
	"fmt"
	"strings"
)

// [http]
// GatewayRequest is what a client sends to the gateway: plain data, no network involved.
type GatewayRequest struct {
	Token  string
	Method string
	Path   string
}

type GatewayResponse struct {
	Status int
	Body   string
}

// RouteHandler gets the authenticated user id and builds the response.
type RouteHandler func(userID string) GatewayResponse

// [/http]

// [services]
type Profile struct {
	Name  string
	Email string
}

type OrderSummary struct {
	ID    string
	Items int
}

// The services trust the user id the gateway hands them. Real systems pass a
// signed token (e.g. a JWT) or secure the gateway-to-service hop (e.g. mTLS), so
// a caller that bypasses the gateway cannot claim to be someone else.
type UserService struct {
	Calls    int // counted first thing in Profile(), so the usage can show who was reached
	profiles map[string]Profile
}

func NewUserService() *UserService {
	return &UserService{profiles: map[string]Profile{
		"alice": {Name: "Alice", Email: "alice@example.com"},
		"bob":   {Name: "Bob", Email: "bob@example.com"},
	}}
}

func (s *UserService) Profile(userID string) Profile {
	s.Calls++
	found, ok := s.profiles[userID]
	if !ok {
		panic("unknown user " + userID) // the gateway only passes ids it authenticated
	}
	return found
}

type OrderService struct {
	Calls  int // counted first thing in Recent()
	orders map[string][]OrderSummary
}

func NewOrderService() *OrderService {
	return &OrderService{orders: map[string][]OrderSummary{
		"alice": {
			{ID: "order-1", Items: 2},
			{ID: "order-2", Items: 3},
		},
	}}
}

func (s *OrderService) Recent(userID string) []OrderSummary {
	s.Calls++
	return s.orders[userID] // bob has no entry: a nil slice, no orders
}

// [/services]

// [authenticator]
type Authenticator struct {
	users map[string]string
}

func NewAuthenticator() *Authenticator {
	return &Authenticator{users: map[string]string{
		"token-alice": "alice",
		"token-bob":   "bob",
	}}
}

// Authenticate returns the user id for a known token, or ("", false) for an unknown one.
func (a *Authenticator) Authenticate(token string) (string, bool) {
	userID, ok := a.users[token]
	return userID, ok
}

// [/authenticator]

// [rateLimiter]
// A fixed-window counter per user. The window is advanced by an explicit
// NextWindow() call instead of a clock, so the example stays deterministic. Real
// limiters often use sliding windows or token buckets, and keep their counters in
// shared storage (e.g. Redis) when the gateway runs as several instances.
type FixedWindowRateLimiter struct {
	Limit  int
	counts map[string]int
}

func NewFixedWindowRateLimiter(limit int) *FixedWindowRateLimiter {
	return &FixedWindowRateLimiter{Limit: limit, counts: map[string]int{}}
}

// TryAcquire counts the request and returns true while the user is under the limit.
func (l *FixedWindowRateLimiter) TryAcquire(userID string) bool {
	used := l.counts[userID]
	if used >= l.Limit {
		return false // rejected requests are not counted
	}
	l.counts[userID] = used + 1
	return true
}

func (l *FixedWindowRateLimiter) Used(userID string) int {
	return l.counts[userID]
}

// NextWindow starts a new window: every user's count goes back to zero.
func (l *FixedWindowRateLimiter) NextWindow() {
	l.counts = map[string]int{}
}

// [/rateLimiter]

// [aggregation]
// Aggregation: one client call becomes two service calls, composed into a single
// response. This handler is a Facade over the two services.
func homeRoute(users *UserService, orders *OrderService) RouteHandler {
	return func(userID string) GatewayResponse {
		profile := users.Profile(userID)
		recent := orders.Recent(userID)
		return GatewayResponse{Status: 200, Body: fmt.Sprintf("%s: %d orders", profile.Name, len(recent))}
	}
}

// [/aggregation]

// [routes]
// The route table: the exact string "<METHOD> <path>" maps to a handler.
func createRoutes(users *UserService, orders *OrderService) map[string]RouteHandler {
	return map[string]RouteHandler{
		"GET /profile": func(userID string) GatewayResponse {
			profile := users.Profile(userID)
			return GatewayResponse{Status: 200, Body: fmt.Sprintf("%s <%s>", profile.Name, profile.Email)}
		},
		"GET /orders": func(userID string) GatewayResponse {
			recent := orders.Recent(userID)
			body := "no orders"
			if len(recent) > 0 {
				lines := make([]string, 0, len(recent))
				for _, order := range recent {
					lines = append(lines, fmt.Sprintf("%s (%d items)", order.ID, order.Items))
				}
				body = strings.Join(lines, ", ")
			}
			return GatewayResponse{Status: 200, Body: body}
		},
		"GET /home": homeRoute(users, orders),
	}
}

// [/routes]

// [gateway]
// A real gateway (Kong, Amazon API Gateway, YARP, ...) is a separate network
// process configured with routes and plugins. Here it is an in-process struct and
// the requests are plain values, so the example runs the same in every language.
// The checks below are a fixed sequence; real gateways usually build them as a
// configurable filter chain, which is the Middleware pattern.
type ApiGateway struct {
	authenticator *Authenticator
	limiter       *FixedWindowRateLimiter
	routes        map[string]RouteHandler
}

func NewApiGateway(authenticator *Authenticator, limiter *FixedWindowRateLimiter, routes map[string]RouteHandler) *ApiGateway {
	return &ApiGateway{authenticator: authenticator, limiter: limiter, routes: routes}
}

func (g *ApiGateway) Handle(request GatewayRequest) GatewayResponse {
	userID, ok := g.authenticator.Authenticate(request.Token)
	if !ok {
		return GatewayResponse{Status: 401, Body: "unknown token"} // nothing else runs
	}
	if !g.limiter.TryAcquire(userID) {
		return GatewayResponse{
			Status: 429,
			Body:   fmt.Sprintf("rate limit: %d requests per window", g.limiter.Limit),
		}
	}
	// Limiting happens before routing, so a request with no route still counts.
	route, ok := g.routes[request.Method+" "+request.Path]
	if !ok {
		return GatewayResponse{Status: 404, Body: fmt.Sprintf("no route for %s %s", request.Method, request.Path)}
	}
	return route(userID)
}

func (g *ApiGateway) NextWindow() {
	g.limiter.NextWindow()
}

// [/gateway]

// [usage]
func send(gateway *ApiGateway, token, method, path string) {
	response := gateway.Handle(GatewayRequest{Token: token, Method: method, Path: path})
	fmt.Printf("%s %s [%s] -> %d %s\n", method, path, token, response.Status, response.Body)
}

func main() {
	users := NewUserService()
	orders := NewOrderService()
	limiter := NewFixedWindowRateLimiter(3)
	gateway := NewApiGateway(NewAuthenticator(), limiter, createRoutes(users, orders))

	send(gateway, "token-alice", "GET", "/profile")  // 200 Alice <alice@example.com>
	send(gateway, "token-alice", "GET", "/orders")   // 200 order-1 (2 items), order-2 (3 items)
	send(gateway, "token-alice", "GET", "/home")     // 200 Alice: 2 orders (two service calls)
	send(gateway, "token-mallory", "GET", "/orders") // 401: no limiter check, no service call
	send(gateway, "token-alice", "GET", "/profile")  // 429: alice has used 3 of 3, not counted
	fmt.Println("[gateway] next window")
	gateway.NextWindow()
	send(gateway, "token-alice", "GET", "/admin") // 404, but it still counts: alice 1/3
	send(gateway, "token-bob", "GET", "/orders")  // 200 no orders: bob is counted separately from alice

	fmt.Printf("backend calls: users %d, orders %d\n", users.Calls, orders.Calls) // users 2, orders 3
	fmt.Printf("rate limit: alice %d/%d, bob %d/%d\n",
		limiter.Used("alice"), limiter.Limit, limiter.Used("bob"), limiter.Limit) // alice 1/3, bob 1/3
}

// [/usage]
