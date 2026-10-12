package main

import "fmt"

// [events]
// What a function is given and what it may return. A function never sees the platform: it
// receives one trigger event plus the managed services, and that is all. The events form a
// closed set, one member per way a function can be triggered. The unexported marker method
// closes the set to the three kinds below, and functions tell them apart with a type switch.
type TriggerEvent interface{ kind() string }

// OrderRequest is the body of the order request. Money is integer cents everywhere.
type OrderRequest struct {
	CustomerID string
	TotalCents int
}

// OrderPlacedMessage is what the createOrder function puts on the order-placed queue.
type OrderPlacedMessage struct {
	OrderID string
}

// HttpEvent is a request from outside.
type HttpEvent struct {
	Method string
	Path   string
	Body   OrderRequest
}

// QueueEvent is a message the platform took from a queue and hands to the function subscribed to it.
type QueueEvent struct {
	Queue   string
	Message OrderPlacedMessage
}

// ScheduleEvent is a schedule firing. It carries no data: the function reads whatever it needs
// from the services.
type ScheduleEvent struct {
	Schedule string
}

func (HttpEvent) kind() string     { return "http" }
func (QueueEvent) kind() string    { return "queue" }
func (ScheduleEvent) kind() string { return "schedule" }

type HttpResponse struct {
	Status int
	Body   string
}

// FunctionInstance is the function contract. Only an http function has a caller waiting for an
// answer, so the others return a nil response. A wrong event kind or a missing order is a
// returned error: a bug in the deployment, not a business outcome. One instance is created per
// cold start and handles invocations one after another.
type FunctionInstance interface {
	Handle(event TriggerEvent, services *Services) (*HttpResponse, error)
}

// Trigger is what makes the platform run a function. The unexported marker method closes the
// set to the three kinds below.
type Trigger interface{ isTrigger() }

type HttpTrigger struct {
	Route string
}

type QueueTrigger struct {
	Queue string
}

type ScheduleTrigger struct {
	Schedule string
}

func (HttpTrigger) isTrigger()     {}
func (QueueTrigger) isTrigger()    {}
func (ScheduleTrigger) isTrigger() {}

// FunctionDefinition is a deployed function: its name, what triggers it, and how to build a fresh
// instance of it.
type FunctionDefinition struct {
	Name    string
	Trigger Trigger
	Create  func() FunctionInstance
}

// formatCents formats 6997 as "69.97" and -250 as "-2.50" with integer arithmetic only (no floats, no thousands separator).
func formatCents(cents int) string {
	sign := ""
	absolute := cents
	if cents < 0 {
		sign = "-"
		absolute = -cents
	}
	return fmt.Sprintf("%s%d.%02d", sign, absolute/100, absolute%100)
}

// [/events]

// [services]
type OrderStatus string

const (
	StatusReceived  OrderStatus = "received"
	StatusReceipted OrderStatus = "receipted"
)

// Order is one row in the orders table. Rows are stored and returned by value, so a caller can
// never change a stored row without saving it again.
type Order struct {
	ID         string
	CustomerID string
	TotalCents int
	Status     OrderStatus
}

// OrderStore is a managed table that outlives every function instance. Real systems use a hosted
// database (DynamoDB, Cosmos DB, Firestore); here it is a map in memory. The id counter lives in
// the store too, so ids stay unique no matter how many instances come and go.
type OrderStore struct {
	// A Go map has no defined iteration order, so the ids are kept in a slice next to it: saving
	// an existing id replaces the row and keeps its place.
	ids    []string
	rows   map[string]Order
	lastID int
}

func NewOrderStore() *OrderStore {
	return &OrderStore{rows: map[string]Order{}}
}

func (s *OrderStore) NextOrderID() string {
	s.lastID++
	return fmt.Sprintf("order-%d", s.lastID)
}

// Save inserts the order, or replaces the row with the same id.
func (s *OrderStore) Save(order Order) {
	if _, exists := s.rows[order.ID]; !exists {
		s.ids = append(s.ids, order.ID)
	}
	s.rows[order.ID] = order
}

func (s *OrderStore) Get(id string) (Order, bool) {
	order, ok := s.rows[id]
	return order, ok
}

// All returns every order, oldest first.
func (s *OrderStore) All() []Order {
	orders := make([]Order, 0, len(s.ids))
	for _, id := range s.ids {
		orders = append(orders, s.rows[id])
	}
	return orders
}

// MessageQueues are managed named queues, first in first out (like SQS, Service Bus or Pub/Sub).
// A message waits here until the platform takes it and hands it to the subscribed function.
type MessageQueues struct {
	queues map[string][]OrderPlacedMessage
}

func NewMessageQueues() *MessageQueues {
	return &MessageQueues{queues: map[string][]OrderPlacedMessage{}}
}

func (q *MessageQueues) Enqueue(queue string, message OrderPlacedMessage) {
	q.queues[queue] = append(q.queues[queue], message)
}

// Take removes and returns the oldest message, or false when the queue is empty.
func (q *MessageQueues) Take(queue string) (OrderPlacedMessage, bool) {
	waiting := q.queues[queue]
	if len(waiting) == 0 {
		return OrderPlacedMessage{}, false
	}
	q.queues[queue] = waiting[1:]
	return waiting[0], true
}

// Services is handed to every invocation. Functions keep nothing that must last anywhere else.
type Services struct {
	Orders *OrderStore
	Queues *MessageQueues
}

// [/services]

// [platform]
type deployedFunction struct {
	def FunctionDefinition
	// warm is the one warm instance, or nil: at most one per function.
	warm       FunctionInstance
	coldStarts int
}

// Platform is the managed runtime. It decides when functions are created, reused, triggered and
// discarded. AWS Lambda, Azure Functions and Google Cloud Functions make all of these decisions
// themselves and run many instances of one function side by side; this type only makes it
// visible. It keeps at most one warm instance per function because the invocations here run one
// after another, and there are no timers or clock: ReclaimIdle stands for idle time passing and
// Tick stands for a schedule firing.
type Platform struct {
	// functions are in registration order: that order is the order queues are drained in.
	functions []*deployedFunction
	services  *Services
}

func NewPlatform(services *Services) *Platform {
	return &Platform{services: services}
}

func (p *Platform) Register(def FunctionDefinition) {
	p.functions = append(p.functions, &deployedFunction{def: def})
}

// Http routes a request to the function whose http trigger has the route "<method> <path>".
func (p *Platform) Http(method string, path string, body OrderRequest) (HttpResponse, error) {
	route := method + " " + path
	var target *deployedFunction
	for _, candidate := range p.functions {
		if trigger, ok := candidate.def.Trigger.(HttpTrigger); ok && trigger.Route == route {
			target = candidate
			break
		}
	}
	// A request nobody listens for is a programmer bug, not something to answer with a 404.
	if target == nil {
		return HttpResponse{}, fmt.Errorf("no function for %s", route)
	}
	response, err := p.invoke(target.def, HttpEvent{Method: method, Path: path, Body: body})
	if err != nil {
		return HttpResponse{}, err
	}
	if response == nil {
		return HttpResponse{}, fmt.Errorf("%s returned no response", target.def.Name)
	}
	return *response, nil
}

// DrainQueues goes through each queue-triggered function in registration order, and keeps taking
// the next message from its queue and invoking the function until that queue is empty.
func (p *Platform) DrainQueues() error {
	for _, deployed := range p.functions {
		trigger, ok := deployed.def.Trigger.(QueueTrigger)
		if !ok {
			continue
		}
		for message, found := p.services.Queues.Take(trigger.Queue); found; message, found = p.services.Queues.Take(trigger.Queue) {
			if _, err := p.invoke(deployed.def, QueueEvent{Queue: trigger.Queue, Message: message}); err != nil {
				return err
			}
		}
	}
	return nil
}

// Tick is a schedule firing: it invokes the function subscribed to the schedule.
func (p *Platform) Tick(schedule string) error {
	var target *deployedFunction
	for _, candidate := range p.functions {
		if trigger, ok := candidate.def.Trigger.(ScheduleTrigger); ok && trigger.Schedule == schedule {
			target = candidate
			break
		}
	}
	if target == nil {
		return fmt.Errorf("no function for schedule %s", schedule)
	}
	_, err := p.invoke(target.def, ScheduleEvent{Schedule: schedule})
	return err
}

// ReclaimIdle scales to zero: it drops every warm instance, and with it everything that was only
// in memory.
func (p *Platform) ReclaimIdle() {
	reclaimed := 0
	for _, deployed := range p.functions {
		if deployed.warm != nil {
			reclaimed++
		}
		deployed.warm = nil
	}
	fmt.Printf("[platform] idle instances reclaimed: %d\n", reclaimed)
}

func (p *Platform) ColdStarts(name string) (int, error) {
	deployed, err := p.deployedOf(name)
	if err != nil {
		return 0, err
	}
	return deployed.coldStarts, nil
}

func (p *Platform) invoke(def FunctionDefinition, event TriggerEvent) (*HttpResponse, error) {
	deployed, err := p.deployedOf(def.Name)
	if err != nil {
		return nil, err
	}
	instance := deployed.warm
	if instance == nil {
		fmt.Printf("[platform] %s: cold start\n", def.Name)
		instance = def.Create()
		deployed.coldStarts++
		deployed.warm = instance // stays warm after this invocation, until ReclaimIdle
	} else {
		fmt.Printf("[platform] %s: warm\n", def.Name)
	}
	return instance.Handle(event, p.services)
}

func (p *Platform) deployedOf(name string) (*deployedFunction, error) {
	for _, candidate := range p.functions {
		if candidate.def.Name == name {
			return candidate, nil
		}
	}
	return nil, fmt.Errorf("unknown function %s", name)
}

// [/platform]

// [createOrder]
type CreateOrderInstance struct {
	// calls is instance memory: it survives from one invocation to the next only while the
	// platform keeps this instance warm, and starts at zero again after every cold start. This is
	// exactly the kind of state you must not rely on. The order ids come from the store.
	calls int
}

func (i *CreateOrderInstance) Handle(event TriggerEvent, services *Services) (*HttpResponse, error) {
	http, ok := event.(HttpEvent)
	if !ok {
		return nil, fmt.Errorf("createOrder expects an http event, got %s", event.kind())
	}
	i.calls++

	if http.Body.TotalCents <= 0 {
		return &HttpResponse{Status: 400, Body: fmt.Sprintf("total must be positive (instance call %d)", i.calls)}, nil
	}

	// Two separate writes: save the order, then enqueue the message. If this instance dies
	// between them, the order exists and nobody is ever told. A real system would close that
	// gap with an outbox or the platform's transactional outputs; this example has neither.
	id := services.Orders.NextOrderID()
	services.Orders.Save(Order{ID: id, CustomerID: http.Body.CustomerID, TotalCents: http.Body.TotalCents, Status: StatusReceived})
	services.Queues.Enqueue("order-placed", OrderPlacedMessage{OrderID: id})
	return &HttpResponse{Status: 201, Body: fmt.Sprintf("%s received (instance call %d)", id, i.calls)}, nil
}

var createOrder = FunctionDefinition{
	Name:    "createOrder",
	Trigger: HttpTrigger{Route: "POST /orders"},
	Create:  func() FunctionInstance { return &CreateOrderInstance{} },
}

// [/createOrder]

// [sendReceipt]
// SendReceiptInstance runs once per order-placed message: it reads the order from the store and
// marks it receipted.
type SendReceiptInstance struct{}

func (*SendReceiptInstance) Handle(event TriggerEvent, services *Services) (*HttpResponse, error) {
	queue, ok := event.(QueueEvent)
	if !ok {
		return nil, fmt.Errorf("sendReceipt expects a queue event, got %s", event.kind())
	}

	order, found := services.Orders.Get(queue.Message.OrderID)
	if !found {
		return nil, fmt.Errorf("unknown order %s", queue.Message.OrderID)
	}
	fmt.Printf("[email] receipt for %s to %s: %s\n", order.ID, order.CustomerID, formatCents(order.TotalCents))
	order.Status = StatusReceipted
	services.Orders.Save(order)
	return nil, nil
}

var sendReceipt = FunctionDefinition{
	Name:    "sendReceipt",
	Trigger: QueueTrigger{Queue: "order-placed"},
	Create:  func() FunctionInstance { return &SendReceiptInstance{} },
}

// [/sendReceipt]

// [dailyReport]
// DailyReportInstance runs when the schedule fires. It only reads: whatever it reports comes from
// the store.
type DailyReportInstance struct{}

func (*DailyReportInstance) Handle(event TriggerEvent, services *Services) (*HttpResponse, error) {
	if _, ok := event.(ScheduleEvent); !ok {
		return nil, fmt.Errorf("dailyReport expects a schedule event, got %s", event.kind())
	}

	orders := services.Orders.All()
	totalCents := 0
	receipted := 0
	for _, order := range orders {
		totalCents += order.TotalCents
		if order.Status == StatusReceipted {
			receipted++
		}
	}
	fmt.Printf("[report] %d orders, total %s, %d receipted\n", len(orders), formatCents(totalCents), receipted)
	return nil, nil
}

var dailyReport = FunctionDefinition{
	Name:    "dailyReport",
	Trigger: ScheduleTrigger{Schedule: "daily-report"},
	Create:  func() FunctionInstance { return &DailyReportInstance{} },
}

// [/dailyReport]

// [usage]
// check stops the demo at once on a platform error: here that can only be a bug in the wiring
// below, not something the example could recover from.
func check(err error) {
	if err != nil {
		panic(err)
	}
}

func main() {
	services := &Services{Orders: NewOrderStore(), Queues: NewMessageQueues()}
	platform := NewPlatform(services)
	platform.Register(createOrder)
	platform.Register(sendReceipt)
	platform.Register(dailyReport)

	post := func(customerID string, totalCents int) {
		response, err := platform.Http("POST", "/orders", OrderRequest{CustomerID: customerID, TotalCents: totalCents})
		check(err)
		fmt.Printf("POST /orders -> %d %s\n", response.Status, response.Body)
	}

	// The first request cold-starts createOrder, the next two reuse its warm instance.
	post("cust-42", 6997)
	post("cust-7", 2999)
	post("cust-9", 0)

	// Nothing has run sendReceipt yet: the platform does that when it drains the queue.
	check(platform.DrainQueues())

	// Idle time passes: every instance is dropped, and the call counter with it.
	platform.ReclaimIdle()
	post("cust-42", 1500)

	// order-3 is still queued, so the report counts it but sees only two receipted orders.
	check(platform.Tick("daily-report"))
	createOrderStarts, err := platform.ColdStarts("createOrder")
	check(err)
	sendReceiptStarts, err := platform.ColdStarts("sendReceipt")
	check(err)
	dailyReportStarts, err := platform.ColdStarts("dailyReport")
	check(err)
	fmt.Printf("cold starts: createOrder %d, sendReceipt %d, dailyReport %d\n", createOrderStarts, sendReceiptStarts, dailyReportStarts)
}

// [/usage]
