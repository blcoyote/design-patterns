package main

import (
	"fmt"
)

// [clock]
// Clock is a fake clock: time only moves when the usage code calls Advance. No real time anywhere.
type Clock struct {
	NowMs int
}

func (c *Clock) Advance(ms int) {
	c.NowMs += ms
}

// [/clock]

type Product struct {
	ID    string
	Name  string
	Price float64
}

// [database]
// ProductDatabase is the slow source of truth. It counts every call it answers, so the demo output stays reproducible.
type ProductDatabase struct {
	Calls    int
	products map[string]Product
}

func NewProductDatabase() *ProductDatabase {
	return &ProductDatabase{products: map[string]Product{"p1": {ID: "p1", Name: "Widget", Price: 9.99}}}
}

// [dbFind]
func (d *ProductDatabase) FindByID(id string) (Product, error) {
	d.Calls++
	product, ok := d.products[id]
	if !ok {
		return Product{}, fmt.Errorf("product %s not found", id)
	}
	return product, nil
}

// [/dbFind]

// [dbUpdate]
func (d *ProductDatabase) Update(id string, price float64) error {
	d.Calls++
	existing, ok := d.products[id]
	if !ok {
		return fmt.Errorf("product %s not found", id)
	}
	existing.Price = price // existing is a copy, so this stores a new value rather than mutating the old one
	d.products[id] = existing
	return nil
}

// [/dbUpdate]

// [/database]

type cacheEntry[T any] struct {
	value     T
	expiresAt int
}

// [cache]
// Cache is an in-memory, TTL-bounded cache. The application decides when to use it: the store has no say.
type Cache[T any] struct {
	entries map[string]cacheEntry[T]
	clock   *Clock
	ttlMs   int
}

func NewCache[T any](clock *Clock, ttlMs int) *Cache[T] {
	return &Cache[T]{entries: map[string]cacheEntry[T]{}, clock: clock, ttlMs: ttlMs}
}

// [cacheGet]
// Get reports a miss as (zero value, false), which stands in for TS's undefined.
func (c *Cache[T]) Get(key string) (T, bool) {
	var zero T
	entry, ok := c.entries[key]
	if !ok {
		return zero, false
	}
	if entry.expiresAt <= c.clock.NowMs {
		delete(c.entries, key) // expired: treat it as a miss and drop the stale value
		return zero, false
	}
	return entry.value, true
}

// [/cacheGet]

// [cacheSet]
func (c *Cache[T]) Set(key string, value T) {
	c.entries[key] = cacheEntry[T]{value: value, expiresAt: c.clock.NowMs + c.ttlMs}
}

// [/cacheSet]

// [cacheInvalidate]
func (c *Cache[T]) Invalidate(key string) {
	delete(c.entries, key)
}

// [/cacheInvalidate]

// [/cache]

// [service]
// ProductService is where Cache-Aside lives: the service, not Cache or ProductDatabase, owns the read/write policy.
type ProductService struct {
	db    *ProductDatabase
	cache *Cache[Product]
}

func NewProductService(db *ProductDatabase, cache *Cache[Product]) *ProductService {
	return &ProductService{db: db, cache: cache}
}

// [getProduct]
func (s *ProductService) GetProduct(id string) (Product, error) {
	if cached, ok := s.cache.Get(id); ok {
		return cached, nil
	}
	product, err := s.db.FindByID(id)
	if err != nil {
		return Product{}, err
	}
	s.cache.Set(id, product)
	return product, nil
}

// [/getProduct]

// [updateProduct]
func (s *ProductService) UpdateProduct(id string, price float64) error {
	if err := s.db.Update(id, price); err != nil {
		return err
	}
	// Invalidate rather than refresh in place: the next read repopulates the
	// cache straight from the source of truth, instead of trusting this one
	// write to be the only writer. See the stale-read risk in the text.
	s.cache.Invalidate(id)
	return nil
}

// [/updateProduct]

// [/service]

// [client]
func main() {
	const ttlMs = 5000

	clock := &Clock{}
	db := NewProductDatabase()
	cache := NewCache[Product](clock, ttlMs)
	service := NewProductService(db, cache)

	product, _ := service.GetProduct("p1")
	fmt.Printf("first read: %s $%.2f — db calls: %d\n", product.Name, product.Price, db.Calls)

	product, _ = service.GetProduct("p1")
	fmt.Printf("second read: %s $%.2f — db calls: %d (hit)\n", product.Name, product.Price, db.Calls)

	_ = service.UpdateProduct("p1", 14.99)
	fmt.Printf("updated price — db calls: %d (after invalidate)\n", db.Calls)

	product, _ = service.GetProduct("p1")
	fmt.Printf("read after update: %s $%.2f — db calls: %d\n", product.Name, product.Price, db.Calls)

	clock.Advance(ttlMs + 1)
	product, _ = service.GetProduct("p1")
	fmt.Printf("read after TTL expiry: %s $%.2f — db calls: %d\n", product.Name, product.Price, db.Calls)
}

// [/client]
