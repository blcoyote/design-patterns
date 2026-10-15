package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// [services]
// Shared backend services. They know nothing about the clients and return their
// data in one general shape. Each counts its calls first thing, so the usage can
// show which services a request reached.
type Profile struct {
	Name  string
	Email string
}

type Order struct {
	ID         string
	Items      int
	TotalCents int
}

type ProfileService struct {
	Calls    int
	profiles map[string]Profile
}

func NewProfileService() *ProfileService {
	return &ProfileService{profiles: map[string]Profile{
		"alice": {Name: "Alice", Email: "alice@example.com"},
		"bob":   {Name: "Bob", Email: "bob@example.com"},
	}}
}

func (s *ProfileService) Profile(userID string) Profile {
	s.Calls++
	found, ok := s.profiles[userID]
	if !ok {
		panic("unknown user " + userID)
	}
	return found
}

type OrderService struct {
	Calls  int
	orders map[string][]Order
}

func NewOrderService() *OrderService {
	return &OrderService{orders: map[string][]Order{
		"alice": {
			{ID: "order-1", Items: 2, TotalCents: 1250},
			{ID: "order-2", Items: 3, TotalCents: 4999},
		},
	}}
}

// Recent returns oldest first; bob has no entry, so no orders.
func (s *OrderService) Recent(userID string) []Order {
	s.Calls++
	return s.orders[userID]
}

type RecommendationService struct {
	Calls int
	Down  bool // the usage switches this on to show a failing service
	picks map[string][]string
}

func NewRecommendationService() *RecommendationService {
	return &RecommendationService{picks: map[string][]string{
		"alice": {"socks", "mug", "lamp"},
		"bob":   {"notebook"},
	}}
}

func (s *RecommendationService) ForUser(userID string) ([]string, error) {
	s.Calls++
	if s.Down {
		return nil, errors.New("recommendations unavailable")
	}
	picks, ok := s.picks[userID]
	if !ok {
		return []string{}, nil // empty, not nil: nil means the call failed
	}
	return picks, nil
}

// [/services]

// [webBff]
// The web team's backend. The account page shows everything, so it calls all
// three services and returns a page model shaped for the web UI. Calls run one
// after another here to keep the example deterministic; a real BFF would
// usually make independent calls in parallel.
type AccountPage struct {
	Heading     string
	OrderLines  []string
	Recommended []string // nil: the section could not be filled
}

func formatCents(cents int) string {
	return fmt.Sprintf("%d.%02d", cents/100, cents%100)
}

type WebBff struct {
	profiles        *ProfileService
	orders          *OrderService
	recommendations *RecommendationService
}

func (b *WebBff) AccountPage(userID string) AccountPage {
	profile := b.profiles.Profile(userID)
	orders := b.orders.Recent(userID)
	recommended, err := b.recommendations.ForUser(userID)
	if err != nil {
		recommended = nil // the web page degrades: the rest of it is still served
	}
	lines := []string{}
	for _, order := range orders {
		lines = append(lines, fmt.Sprintf("%s: %d items, %s", order.ID, order.Items, formatCents(order.TotalCents)))
	}
	return AccountPage{
		Heading:     fmt.Sprintf("%s (%s)", profile.Name, profile.Email),
		OrderLines:  lines,
		Recommended: recommended,
	}
}

// [/webBff]

// [mobileBff]
// The mobile team's backend. The app's home screen shows a small card, so this
// BFF calls only the two services it needs, never recommendations, and answers
// with compact JSON in the app's own field names.
type MobileHomeCard struct {
	Name       string  `json:"name"`
	OrderCount int     `json:"orderCount"`
	LastOrder  *string `json:"lastOrder"` // nil is written as null
}

type MobileBff struct {
	profiles *ProfileService
	orders   *OrderService
}

func (b *MobileBff) Home(userID string) string {
	profile := b.profiles.Profile(userID)
	orders := b.orders.Recent(userID)
	card := MobileHomeCard{Name: profile.Name, OrderCount: len(orders)}
	if len(orders) > 0 {
		card.LastOrder = &orders[len(orders)-1].ID
	}
	wire, err := json.Marshal(card)
	if err != nil {
		panic(err)
	}
	return string(wire)
}

// [/mobileBff]

// [clients]
// Each client knows only its own BFF, never the services behind it.
func showWebAccount(bff *WebBff, userID string) {
	page := bff.AccountPage(userID)
	fmt.Printf("[web] %s\n", page.Heading)
	if len(page.OrderLines) == 0 {
		fmt.Println("[web]   no orders")
	}
	for _, line := range page.OrderLines {
		fmt.Printf("[web]   %s\n", line)
	}
	recommended := "unavailable"
	if page.Recommended != nil {
		recommended = strings.Join(page.Recommended, ", ")
	}
	fmt.Printf("[web]   recommended: %s\n", recommended)
}

func showMobileHome(bff *MobileBff, userID string) {
	fmt.Printf("[mobile] %s\n", bff.Home(userID))
}

// [/clients]

// [usage]
func main() {
	profiles := NewProfileService()
	orders := NewOrderService()
	recommendations := NewRecommendationService()
	webBff := &WebBff{profiles: profiles, orders: orders, recommendations: recommendations}
	mobileBff := &MobileBff{profiles: profiles, orders: orders}

	showWebAccount(webBff, "alice")    // three service calls: heading, two order lines, three picks
	showMobileHome(mobileBff, "alice") // {"name":"Alice","orderCount":2,"lastOrder":"order-2"}
	showMobileHome(mobileBff, "bob")   // {"name":"Bob","orderCount":0,"lastOrder":null}

	fmt.Println("[recommendations] down")
	recommendations.Down = true
	showWebAccount(webBff, "bob") // no orders, recommended: unavailable

	fmt.Printf("service calls: profile %d, orders %d, recommendations %d\n",
		profiles.Calls, orders.Calls, recommendations.Calls) // profile 4, orders 4, recommendations 2
}

// [/usage]
