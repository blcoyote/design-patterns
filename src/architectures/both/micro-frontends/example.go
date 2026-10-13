package main

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// [services]
// The shared backend services. Each counts its calls: the counter goes up at the start of
// every call, before anything can fail, so a call that fails is still counted. Money is
// integer cents everywhere. A sku a service does not know is a programmer bug, so it panics.

type CatalogService struct {
	Calls int
	names map[string]string
}

func NewCatalogService() *CatalogService {
	return &CatalogService{names: map[string]string{"sku-1": "Widget"}}
}

func (s *CatalogService) Name(sku string) string {
	s.Calls++
	name, ok := s.names[sku]
	if !ok {
		panic("unknown sku " + sku)
	}
	return name
}

type PricingService struct {
	Calls  int
	prices map[string]int
}

func NewPricingService() *PricingService {
	return &PricingService{prices: map[string]int{"sku-1": 1999}}
}

func (s *PricingService) PriceCents(sku string) int {
	s.Calls++
	cents, ok := s.prices[sku]
	if !ok {
		panic("unknown sku " + sku)
	}
	return cents
}

type StockService struct {
	Calls int
	units map[string]int
}

func NewStockService() *StockService {
	return &StockService{units: map[string]int{"sku-1": 3}}
}

func (s *StockService) InStock(sku string) int {
	s.Calls++
	units, ok := s.units[sku]
	if !ok {
		panic("unknown sku " + sku)
	}
	return units
}

// RecommendationService is the one service that can be switched off, to show that a failure
// stays inside its team's slot.
type RecommendationService struct {
	Calls        int
	down         bool
	relatedBySku map[string][]string
}

func NewRecommendationService() *RecommendationService {
	return &RecommendationService{relatedBySku: map[string][]string{"sku-1": {"Gadget", "Gizmo"}}}
}

func (s *RecommendationService) SetDown(down bool) {
	s.down = down
}

// Related returns a copy of the related names, or an error while the service is down.
func (s *RecommendationService) Related(sku string) ([]string, error) {
	s.Calls++
	if s.down {
		return nil, errors.New("recommendation service unavailable")
	}
	names, ok := s.relatedBySku[sku]
	if !ok {
		panic("unknown sku " + sku)
	}
	return append([]string(nil), names...), nil
}

// formatCents formats 1999 as "19.99" and -250 as "-2.50" with integer arithmetic only (no
// floats, no thousands separator).
func formatCents(cents int) string {
	absolute := cents
	sign := ""
	if cents < 0 {
		absolute = -cents
		sign = "-"
	}
	return fmt.Sprintf("%s%d.%02d", sign, absolute/100, absolute%100)
}

// [/services]

// [shell]
// Fragment is what every team hands to the shell: who owns the fragment, which release it is,
// and a Render method that returns an HTML string for one product.
//
// Fragments here return strings built from trusted constant data. A real fragment must
// escape every value it puts into markup (names, prices, user input), or it opens the page
// to injection.
type Fragment interface {
	Team() string
	Version() string
	Render(sku string) (string, error)
}

// FragmentRegistry holds which fragment each team currently serves. Register adds a fragment
// without a word (the set the shell starts with); Deploy is the later release path: it replaces
// that team's fragment and says so. Either way the team keeps its one slot, and the order of the
// page comes only from the shell's template, never from this map.
type FragmentRegistry struct {
	fragments map[string]Fragment
}

func NewFragmentRegistry() *FragmentRegistry {
	return &FragmentRegistry{fragments: map[string]Fragment{}}
}

func (r *FragmentRegistry) Register(fragment Fragment) {
	r.fragments[fragment.Team()] = fragment
}

func (r *FragmentRegistry) Deploy(fragment Fragment) {
	r.fragments[fragment.Team()] = fragment
	fmt.Printf("[registry] %s deployed %s\n", fragment.Team(), fragment.Version())
}

func (r *FragmentRegistry) Get(team string) Fragment {
	fragment, ok := r.fragments[team]
	// A template slot nobody has registered is a programmer bug, not a failed fragment.
	if !ok {
		panic("no fragment registered for " + team)
	}
	return fragment
}

// Shell is owned by a platform team: it composes the page. These examples compose on the
// server, like Server-Side Includes, Edge-Side Includes, Zalando's Tailor or FINN.no's
// Podium, because they must run as plain code in TypeScript, C#, Python and Go. Many real
// micro-frontends compose in the browser instead: Webpack Module Federation, Web
// Components, single-spa or iframes. Neither way is the only one.
//
// The page template is an ordered list of slots. RenderPage walks that list, never the
// registry, so the order is the same on every run. If a fragment fails, the shell puts a
// comment in its slot and carries on: one team's failure does not take the page down.
type Shell struct {
	registry *FragmentRegistry
	slots    []string
}

func NewShell(registry *FragmentRegistry) *Shell {
	return &Shell{registry: registry, slots: []string{"product", "checkout", "inspire"}}
}

func (s *Shell) RenderPage(sku string) string {
	parts := make([]string, 0, len(s.slots))
	for _, team := range s.slots {
		fragment := s.registry.Get(team)
		html, err := fragment.Render(sku)
		if err != nil {
			parts = append(parts, "<!-- "+team+" unavailable -->")
			continue
		}
		parts = append(parts, html)
	}
	return "<main>" + strings.Join(parts, "") + "</main>"
}

// [/shell]

// [productTeam]
// ProductFragment is the Product team's fragment: the product's name as a heading, read from
// the catalog.
type ProductFragment struct {
	catalog *CatalogService
}

func (ProductFragment) Team() string    { return "product" }
func (ProductFragment) Version() string { return "product-details v1" }

func (f ProductFragment) Render(sku string) (string, error) {
	return "<h1>" + f.catalog.Name(sku) + "</h1>", nil
}

// [/productTeam]

// [checkoutTeam]
// BuyBoxModel is the one thing the buy box needs to know about a product.
type BuyBoxModel struct {
	PriceCents int
	InStock    int
}

// CheckoutWebBff is the Checkout team's backend for its own web fragment (the Checkout web
// BFF). It puts one call in front of two services (a facade) and reshapes their answers into
// the buy box's model (an adapter): that shape and nothing more.
type CheckoutWebBff struct {
	pricing *PricingService
	stock   *StockService
}

func (b CheckoutWebBff) BuyBox(sku string) BuyBoxModel {
	priceCents := b.pricing.PriceCents(sku)
	inStock := b.stock.InStock(sku)
	return BuyBoxModel{PriceCents: priceCents, InStock: inStock}
}

// BuyBoxV1 is release 1 of the buy box: the price and how many are left.
type BuyBoxV1 struct {
	bff CheckoutWebBff
}

func (BuyBoxV1) Team() string    { return "checkout" }
func (BuyBoxV1) Version() string { return "buy-box v1" }

func (f BuyBoxV1) Render(sku string) (string, error) {
	model := f.bff.BuyBox(sku)
	return "<button>Buy for " + formatCents(model.PriceCents) + " (" + strconv.Itoa(model.InStock) + " left)</button>", nil
}

// BuyBoxV2 is release 2 of the buy box, shipped by the Checkout team alone: new wording, and
// it no longer shows the stock count. It still asks the BFF for the whole model, so pricing and
// stock are both still called.
type BuyBoxV2 struct {
	bff CheckoutWebBff
}

func (BuyBoxV2) Team() string    { return "checkout" }
func (BuyBoxV2) Version() string { return "buy-box v2" }

func (f BuyBoxV2) Render(sku string) (string, error) {
	model := f.bff.BuyBox(sku)
	return "<button>Add to basket: " + formatCents(model.PriceCents) + "</button>", nil
}

// [/checkoutTeam]

// [inspireTeam]
// RecommendationsFragment is the Inspire team's fragment: a list of related products. It
// returns the service's error rather than handling it; deciding what the page does when this
// fragment fails is the shell's job.
type RecommendationsFragment struct {
	recommendations *RecommendationService
}

func (RecommendationsFragment) Team() string    { return "inspire" }
func (RecommendationsFragment) Version() string { return "recommendations v1" }

func (f RecommendationsFragment) Render(sku string) (string, error) {
	names, err := f.recommendations.Related(sku)
	if err != nil {
		return "", err
	}
	items := make([]string, 0, len(names))
	for _, name := range names {
		items = append(items, "<li>"+name+"</li>")
	}
	return "<ul>" + strings.Join(items, "") + "</ul>", nil
}

// [/inspireTeam]

// [mobileBff]
// MobileProductCard is what the mobile app gets for a product: strings and a flag, ready to
// show.
type MobileProductCard struct {
	Name    string
	Price   string
	InStock bool
}

// MobileBff is the Mobile team's backend, built for one client type, the mobile app. It puts
// one call in front of three services (a facade) and reshapes their answers into the app's own
// card (an adapter): a formatted price and a yes/no instead of a count.
type MobileBff struct {
	catalog *CatalogService
	pricing *PricingService
	stock   *StockService
}

func (b MobileBff) ProductCard(sku string) MobileProductCard {
	name := b.catalog.Name(sku)
	cents := b.pricing.PriceCents(sku)
	units := b.stock.InStock(sku)
	return MobileProductCard{Name: name, Price: formatCents(cents), InStock: units > 0}
}

// ToWire returns the compact JSON the app receives, written out by hand so every language
// prints the same characters: no spaces, keys in this order. The values here are trusted
// constants; a real serializer would escape them.
func ToWire(card MobileProductCard) string {
	return `{"name":"` + card.Name + `","price":"` + card.Price + `","inStock":` + strconv.FormatBool(card.InStock) + `}`
}

// [/mobileBff]

// [usage]
func main() {
	catalog := NewCatalogService()
	pricing := NewPricingService()
	stock := NewStockService()
	recommendations := NewRecommendationService()

	checkoutBff := CheckoutWebBff{pricing: pricing, stock: stock}
	mobileBff := MobileBff{catalog: catalog, pricing: pricing, stock: stock}

	// The shell starts with these three fragments. Register is silent; Deploy, used later, prints.
	registry := NewFragmentRegistry()
	registry.Register(ProductFragment{catalog: catalog})
	registry.Register(BuyBoxV1{bff: checkoutBff})
	registry.Register(RecommendationsFragment{recommendations: recommendations})
	shell := NewShell(registry)

	fmt.Printf("page: %s\n", shell.RenderPage("sku-1"))
	fmt.Printf("mobile: %s\n", ToWire(mobileBff.ProductCard("sku-1")))

	// The Checkout team ships a new buy box. No other team and not the shell is redeployed.
	registry.Deploy(BuyBoxV2{bff: checkoutBff})

	// The recommendation service fails; the page still renders, without that fragment.
	recommendations.SetDown(true)
	fmt.Println("[inspire] recommendation service goes down")
	fmt.Printf("page: %s\n", shell.RenderPage("sku-1"))

	fmt.Printf(
		"service calls: catalog %d, pricing %d, stock %d, recommendations %d\n",
		catalog.Calls, pricing.Calls, stock.Calls, recommendations.Calls,
	)
}

// [/usage]
