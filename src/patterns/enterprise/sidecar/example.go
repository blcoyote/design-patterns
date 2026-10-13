package main

import "fmt"

// [http]
type HttpRequest struct {
	Method  string
	To      string
	Path    string
	Headers map[string]string
}

type HttpResponse struct {
	Status int
	Body   string
}

// Outbound is anything that can carry a request to another service.
type Outbound interface {
	Send(request HttpRequest) HttpResponse
}

// Service is a service that can answer a request.
type Service interface {
	Handle(request HttpRequest) HttpResponse
}

// Returns a NEW request with a copied header map; the original is unchanged.
// Ranging over the input map here only copies it; nothing is printed from it.
func withHeader(request HttpRequest, name string, value string) HttpRequest {
	headers := make(map[string]string, len(request.Headers)+1)
	for k, v := range request.Headers {
		headers[k] = v
	}
	headers[name] = value
	request.Headers = headers // request is a copy of the caller's struct, so this does not touch theirs
	return request
}

// [/http]

// [inventory]
type InventoryService struct {
	Calls    int
	failNext bool
}

// Scripted failure: exactly the next call answers 503.
func (s *InventoryService) FailNextCall() {
	s.failNext = true
	fmt.Println("[inventory] next call will fail with 503")
}

func (s *InventoryService) Handle(request HttpRequest) HttpResponse {
	s.Calls++
	if _, ok := request.Headers["x-client-identity"]; !ok {
		return HttpResponse{Status: 401, Body: "no client identity"}
	}
	if s.failNext {
		s.failNext = false
		return HttpResponse{Status: 503, Body: "busy"}
	}
	sku := request.Path[len("/stock/"):]
	return HttpResponse{Status: 200, Body: fmt.Sprintf("%s: 3 in stock", sku)}
}

// [/inventory]

// [network]
// Stands in for the cluster network: a lookup by service name, then a method call.
type Network struct {
	services map[string]Service
}

func NewNetwork() *Network {
	return &Network{services: map[string]Service{}}
}

func (n *Network) Register(name string, service Service) {
	n.services[name] = service
}

func (n *Network) Send(request HttpRequest) HttpResponse {
	service, ok := n.services[request.To]
	if !ok {
		panic(fmt.Sprintf("unknown service: %s", request.To))
	}
	return service.Handle(request)
}

// [/network]

// [sidecar]
// The process boundary is simulated: the app and this sidecar are two objects in one
// process, and the "network" between them is a method call. A real sidecar is a
// separate process or container deployed with each service instance.
//
// The x-client-identity header stands in for mutual TLS. A real sidecar presents a
// certificate on an encrypted connection; here it is a plain header, and inventory
// only checks that the header is present, which is not secure.
type Sidecar struct {
	Requests    int
	Attempts    int
	Retries     int
	Failures    int
	serviceName string
	upstream    Outbound
	maxRetries  int
}

func NewSidecar(serviceName string, upstream Outbound, maxRetries int) *Sidecar {
	return &Sidecar{serviceName: serviceName, upstream: upstream, maxRetries: maxRetries}
}

func (s *Sidecar) Send(request HttpRequest) HttpResponse {
	s.Requests++
	outgoing := withHeader(request, "x-client-identity", s.serviceName)

	// Retrying is safe here only because the call is an idempotent GET, and only a
	// 503 is retried. Other statuses, such as 401, are returned as they are.
	attemptsHere := 0
	var response HttpResponse
	for {
		attemptsHere++
		s.Attempts++
		response = s.upstream.Send(outgoing)
		if response.Status != 503 || attemptsHere > s.maxRetries {
			break
		}
	}

	s.Retries += attemptsHere - 1
	if response.Status >= 400 {
		s.Failures++
	}
	fmt.Printf("[sidecar %s] %s %s%s -> %d (attempts %d)\n", s.serviceName, request.Method, request.To, request.Path, response.Status, attemptsHere)
	return response
}

func (s *Sidecar) SetMaxRetries(n int) {
	s.maxRetries = n
	fmt.Printf("[sidecar %s] config reloaded: max retries %d\n", s.serviceName, n)
}

// [/sidecar]

// [app]
// There is no identity, retry or metrics code here: that all lives in the sidecar.
// Real meshes usually redirect the app's traffic to the sidecar transparently (for
// example with iptables rules), so the app code does not change at all. Here the
// sidecar is handed in explicitly as an Outbound.
type OrderService struct {
	outbound Outbound
}

func NewOrderService(outbound Outbound) *OrderService {
	return &OrderService{outbound: outbound}
}

func (o *OrderService) CheckStock(sku string) HttpResponse {
	response := o.outbound.Send(HttpRequest{
		Method:  "GET",
		To:      "inventory",
		Path:    "/stock/" + sku,
		Headers: map[string]string{},
	})
	fmt.Printf("[orders] stock %s: %d %s\n", sku, response.Status, response.Body)
	return response
}

// [/app]

// [usage]
func main() {
	inventory := &InventoryService{}
	network := NewNetwork()
	network.Register("inventory", inventory)

	sidecar := NewSidecar("orders", network, 1)
	orders := NewOrderService(sidecar)

	orders.CheckStock("sku-1")

	inventory.FailNextCall()
	orders.CheckStock("sku-1") // the sidecar retries; the app sees only the 200

	fmt.Println("[usage] same app code wired straight to the network, bypassing the sidecar")
	direct := NewOrderService(network)
	direct.CheckStock("sku-1")

	sidecar.SetMaxRetries(0)
	inventory.FailNextCall()
	orders.CheckStock("sku-1")

	fmt.Printf("sidecar metrics: requests %d, attempts %d, retries %d, failures %d\n", sidecar.Requests, sidecar.Attempts, sidecar.Retries, sidecar.Failures)
	fmt.Printf("inventory calls: %d\n", inventory.Calls)
}

// [/usage]
