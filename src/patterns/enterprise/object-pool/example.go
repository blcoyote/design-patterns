package main

import (
	"errors"
	"fmt"
	"sync"
)

// [database]
// RawDatabaseSocket is the expensive real resource being pooled — e.g. a raw DB/TCP socket.
type RawDatabaseSocket struct {
	ID int
}

func (s *RawDatabaseSocket) Query(sql string) {
	fmt.Printf("socket#%d -> %s\n", s.ID, sql)
}

// [/database]

// [poolable]
type Poolable interface {
	// Reset clears any per-borrower state before the object is handed to someone new.
	Reset()
}

// [/poolable]

// [connection]
type PooledConnection struct {
	socket *RawDatabaseSocket
	txOpen bool
}

func NewPooledConnection(socket *RawDatabaseSocket) *PooledConnection {
	return &PooledConnection{socket: socket}
}

func (c *PooledConnection) Query(sql string) {
	c.socket.Query(sql)
}

func (c *PooledConnection) BeginTransaction() {
	c.txOpen = true
}

// [reset]
func (c *PooledConnection) Reset() {
	c.txOpen = false // never leak an open transaction to the next borrower
}

// [/reset]

// [/connection]

// [pool]
// ObjectPool stands in for TS's Promise with a channel: Acquire returns a
// receive-only channel that already holds the item, or that a later Release
// fills. The mutex guards the pool's own bookkeeping for concurrent callers
// (TS and Python rely on a single-threaded event loop; C# locks too); it is
// never held while a caller waits on a channel.
type ObjectPool[T interface {
	Poolable
	comparable
}] struct {
	mu      sync.Mutex
	idle    []T
	inUse   map[T]struct{}
	waiting []chan T
	created int
	factory func() T
	maxSize int
}

func NewObjectPool[T interface {
	Poolable
	comparable
}](factory func() T, maxSize int) *ObjectPool[T] {
	return &ObjectPool[T]{inUse: map[T]struct{}{}, factory: factory, maxSize: maxSize}
}

// [acquire]
func (p *ObjectPool[T]) Acquire() <-chan T {
	p.mu.Lock()
	defer p.mu.Unlock()
	// A buffered channel of 1 lets the item be handed over without a receiver waiting.
	ch := make(chan T, 1)
	if n := len(p.idle); n > 0 {
		reused := p.idle[n-1]
		p.idle = p.idle[:n-1]
		p.inUse[reused] = struct{}{}
		ch <- reused
		return ch
	}
	if p.created < p.maxSize {
		item := p.factory() // lazy creation — if this panics, no slot is used up
		p.created++         // only count it once the object actually exists
		p.inUse[item] = struct{}{}
		ch <- item
		return ch
	}
	// Every slot is taken: queue this request until a Release() frees one up.
	p.waiting = append(p.waiting, ch)
	return ch
}

// [/acquire]

// [release]
func (p *ObjectPool[T]) Release(item T) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if _, ok := p.inUse[item]; !ok {
		panic(errors.New("Release() called with an item that is not checked out from this pool"))
	}
	delete(p.inUse, item)
	item.Reset() // scrub borrower state before anyone else sees this object
	// Waiters here cannot cancel (this example gives acquire() no timeout), so every
	// queued waiter is still listening. A pool that adds timeouts must skip waiters
	// that gave up, as the Python tab does for cancelled futures.
	if len(p.waiting) > 0 {
		next := p.waiting[0]
		p.waiting = p.waiting[1:]
		p.inUse[item] = struct{}{}
		next <- item // hand it straight to the waiting caller — it never goes idle
	} else {
		p.idle = append(p.idle, item)
	}
}

// [/release]

type PoolStats struct {
	Idle, InUse, Waiting int
}

func (p *ObjectPool[T]) Stats() PoolStats {
	p.mu.Lock()
	defer p.mu.Unlock()
	return PoolStats{Idle: len(p.idle), InUse: len(p.inUse), Waiting: len(p.waiting)}
}

// [/pool]

// [usage]
func main() {
	nextSocketID := 0
	pool := NewObjectPool(func() *PooledConnection {
		nextSocketID++
		return NewPooledConnection(&RawDatabaseSocket{ID: nextSocketID})
	}, 3)

	// [clientA]
	connA := <-pool.Acquire() // pool is empty — lazily creates connection #1
	connA.Query("SELECT 1")
	pool.Release(connA) // reset, then back to idle (or straight to a waiter)
	// [/clientA]

	// [clientB]
	// Fill every slot (maxSize = 3), then watch a caller queue and get served:
	c1, c2, c3 := <-pool.Acquire(), <-pool.Acquire(), <-pool.Acquire()
	c2.Query("SELECT 2")
	c3.Query("SELECT 3")

	pending := pool.Acquire() // queued: every slot is already checked out
	pool.Release(c1)          // handed straight to the queued caller instead of going idle
	c4 := <-pending           // c4 is c1, reused rather than freshly constructed
	_ = c4
	// [/clientB]
}

// [/usage]
