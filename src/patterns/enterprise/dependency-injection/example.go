package main

import (
	"errors"
	"fmt"
)

// [emailSender]
// Go interfaces are satisfied implicitly: no "implements" keyword is needed.
type EmailSender interface {
	Send(to, subject, body string)
}

// [/emailSender]

// [smtpEmailSender]
type SmtpEmailSender struct{}

func (s *SmtpEmailSender) Send(to, subject, body string) {
	fmt.Printf("SMTP -> %s: %s\n", to, subject)
}

// [/smtpEmailSender]

// [config]
type Config struct {
	DbURL string
}

func NewConfig() *Config {
	return &Config{DbURL: "postgres://localhost/orders"}
}

// [/config]

// [orderRepository]
type OrderRepository interface {
	Save(orderID string)
	FindByID(orderID string) any
}

// [/orderRepository]

// [sqlOrderRepository]
type SqlOrderRepository struct {
	config *Config
}

func NewSqlOrderRepository(config *Config) *SqlOrderRepository {
	return &SqlOrderRepository{config: config}
}

func (r *SqlOrderRepository) Save(orderID string) {
	fmt.Printf("INSERT INTO orders (%s) ...\n", r.config.DbURL)
}

func (r *SqlOrderRepository) FindByID(orderID string) any {
	fmt.Printf("SELECT * FROM orders (%s) WHERE id = %s\n", r.config.DbURL, orderID)
	return nil
}

// [/sqlOrderRepository]

// [orderService]
type OrderService struct {
	repository  OrderRepository
	emailSender EmailSender
}

func NewOrderService(repository OrderRepository, emailSender EmailSender) *OrderService {
	return &OrderService{repository: repository, emailSender: emailSender}
}

func (s *OrderService) PlaceOrder(orderID, customerEmail string) {
	s.repository.Save(orderID)
	s.emailSender.Send(customerEmail, "Order placed", fmt.Sprintf("Order %s is confirmed.", orderID))
}

// [/orderService]

// [orderController]
type OrderController struct {
	service *OrderService
}

func NewOrderController(service *OrderService) *OrderController {
	return &OrderController{service: service}
}

func (c *OrderController) Handle(orderID, customerEmail string) {
	c.service.PlaceOrder(orderID, customerEmail)
}

// [/orderController]

// [container]
// A container is nothing magical: a map of providers (each listing the keys it
// needs) plus a Resolve() that builds those dependencies first, recursively,
// and caches every result as a singleton. Real containers (Spring, ASP.NET
// Core's IServiceCollection, InversifyJS) also offer transient (new instance
// every resolve) and scoped (one instance per request/operation) lifetimes;
// this toy container only ever does singleton.
type provider struct {
	deps   []string
	create func(deps ...any) any
}

type Container struct {
	providers  map[string]provider
	singletons map[string]any
}

func NewContainer() *Container {
	return &Container{providers: map[string]provider{}, singletons: map[string]any{}}
}

func (c *Container) Register(key string, deps []string, create func(deps ...any) any) {
	c.providers[key] = provider{deps: deps, create: create}
}

func (c *Container) resolve(key string) any {
	if _, ok := c.singletons[key]; !ok {
		p, ok := c.providers[key]
		if !ok {
			panic(errors.New("No provider registered for " + key))
		}
		// Build whatever it needs first (recursively), then construct it.
		args := make([]any, len(p.deps))
		for i, dep := range p.deps {
			args[i] = c.resolve(dep)
		}
		c.singletons[key] = p.create(args...)
	}
	return c.singletons[key]
}

// Resolve is a function rather than a method because Go methods cannot have
// type parameters. T only tells the compiler what comes back (via a type
// assertion): the registered provider decides what is actually built.
func Resolve[T any](c *Container, key string) T {
	return c.resolve(key).(T)
}

// [/container]

// [usage]
func main() {
	// This block — the only place that touches Container directly — is the real
	// composition root: it configures the graph once, then hands off to plain
	// objects that never see the container again.
	container := NewContainer()

	container.Register("config", nil, func(deps ...any) any { return NewConfig() })
	container.Register("orderRepository", []string{"config"}, func(deps ...any) any {
		return NewSqlOrderRepository(deps[0].(*Config))
	})
	container.Register("emailSender", nil, func(deps ...any) any { return &SmtpEmailSender{} })
	container.Register("orderService", []string{"orderRepository", "emailSender"}, func(deps ...any) any {
		return NewOrderService(deps[0].(OrderRepository), deps[1].(EmailSender))
	})
	container.Register("orderController", []string{"orderService"}, func(deps ...any) any {
		return NewOrderController(deps[0].(*OrderService))
	})

	// Ask only for the root — the container works out the rest of the graph.
	// Note: OrderController and OrderService never call container.Resolve()
	// themselves — if they did, that would be the Service Locator pattern, not DI.
	orderController := Resolve[*OrderController](container, "orderController")
	orderController.Handle("A-1001", "ada@example.com")

	testOrderService()
}

// [/usage]

// [test]
// Tests don't need the container at all — just construct OrderService by hand
// with fakes for both of its dependencies. (In Go this lives in a function that
// main calls, because the usage region is main itself.)
type FakeOrderRepository struct {
	saved []string
}

func (r *FakeOrderRepository) Save(orderID string) {
	r.saved = append(r.saved, orderID)
}

func (r *FakeOrderRepository) FindByID(orderID string) any {
	return nil
}

type FakeEmailSender struct {
	sent []string
}

func (s *FakeEmailSender) Send(to, subject, body string) {
	s.sent = append(s.sent, fmt.Sprintf("%s: %s", to, subject))
}

func testOrderService() {
	fakeRepo := &FakeOrderRepository{}
	service := NewOrderService(fakeRepo, &FakeEmailSender{})
	service.PlaceOrder("A-1001", "ada@example.com")
}

// [/test]
