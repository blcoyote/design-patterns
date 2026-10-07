package main

import (
	"errors"
	"fmt"
	"strings"
)

type User struct {
	ID   string
	Name string
}

type Post struct {
	ID       string
	AuthorID string
}

// [database]
type UserDatabase struct {
	// Rows are stored (and come back) in this order, not in the order they were asked for.
	users []User
	// Counts every query so the demo output stays reproducible.
	Queries int
}

func NewUserDatabase() *UserDatabase {
	return &UserDatabase{users: []User{{"u2", "Grace"}, {"u1", "Ada"}}}
}

// [dbFind]
// One round trip for any number of ids, like SELECT … WHERE id IN (…).
func (db *UserDatabase) FindByIDs(ids []string) []User {
	db.Queries++
	fmt.Printf("db: SELECT users WHERE id IN (%s)\n", strings.Join(ids, ", "))
	var rows []User
	for _, user := range db.users {
		for _, id := range ids {
			if user.ID == id {
				rows = append(rows, user)
				break
			}
		}
	}
	return rows
}

// [/dbFind]
// [/database]

// The result of a Load() that may not have run yet.
type Pending struct {
	user *User
}

func (p *Pending) Resolve(user User) {
	p.user = &user
}

func (p *Pending) Get() (User, error) {
	if p.user == nil {
		return User{}, errors.New("not loaded yet: Dispatch() has not run")
	}
	return *p.user, nil
}

// Without a loader: every post asks the database for its own author.
type NaiveResolver struct {
	db *UserDatabase
}

func (r *NaiveResolver) Author(post Post) User {
	// [naiveAuthor]
	return r.db.FindByIDs([]string{post.AuthorID})[0]
	// [/naiveAuthor]
}

// [userLoader]
// One loader per request: its cache must not outlive the request, or it would
// serve stale data and leak users across requests.
// Real loaders dispatch by themselves at the end of the current tick (JavaScript's
// DataLoader uses a microtask); here Dispatch() is called by hand so the batching
// moment is visible and every language behaves the same.
type UserLoader struct {
	db    *UserDatabase
	cache map[string]*Pending
	queue []string
}

func NewUserLoader(db *UserDatabase) *UserLoader {
	return &UserLoader{db: db, cache: map[string]*Pending{}}
}

func (l *UserLoader) Load(id string) *Pending {
	// [loaderLoad]
	// The cache holds queued keys too, so a repeated id shares one slot: it is
	// neither queued twice nor fetched twice.
	if known, ok := l.cache[id]; ok {
		return known
	}
	pending := &Pending{}
	l.cache[id] = pending
	l.queue = append(l.queue, id)
	return pending
	// [/loaderLoad]
}

func (l *UserLoader) Dispatch() error {
	// [loaderBatch]
	// Take the whole queue, ask once, then match rows back to keys by id,
	// because the database may return them in any order.
	keys := l.queue
	l.queue = nil
	if len(keys) == 0 {
		return nil
	}
	byID := map[string]User{}
	for _, user := range l.db.FindByIDs(keys) {
		byID[user.ID] = user
	}
	for _, key := range keys {
		user, ok := byID[key]
		if !ok {
			return fmt.Errorf("user %s not found", key)
		}
		l.cache[key].Resolve(user)
	}
	return nil
	// [/loaderBatch]
}

// [/userLoader]

// [postResolver]
type PostResolver struct {
	users *UserLoader
}

// Returns at once with a Pending result; no query has run yet.
func (r *PostResolver) Author(post Post) *Pending {
	return r.users.Load(post.AuthorID)
}

// [/postResolver]

func main() {
	// [client]
	posts := []Post{{"P1", "u1"}, {"P2", "u2"}, {"P3", "u1"}}

	// Without a loader: one query per post (the N+1 problem).
	db := NewUserDatabase()
	naive := &NaiveResolver{db: db}
	for _, post := range posts {
		fmt.Printf("%s by %s\n", post.ID, naive.Author(post).Name)
	}
	// db: SELECT users WHERE id IN (u1)
	// P1 by Ada
	// db: SELECT users WHERE id IN (u2)
	// P2 by Grace
	// db: SELECT users WHERE id IN (u1)
	// P3 by Ada
	fmt.Printf("queries: %d\n", db.Queries)
	// queries: 3

	// With a loader: all three posts share one query.
	db.Queries = 0
	loader := NewUserLoader(db)
	resolver := &PostResolver{users: loader}
	var authors []*Pending
	for _, post := range posts {
		authors = append(authors, resolver.Author(post))
	}
	fmt.Printf("queries so far: %d\n", db.Queries)
	// queries so far: 0
	loader.Dispatch() // the end of the tick
	// db: SELECT users WHERE id IN (u1, u2)
	for i, post := range posts {
		user, _ := authors[i].Get()
		fmt.Printf("%s by %s\n", post.ID, user.Name)
	}
	// P1 by Ada
	// P2 by Grace
	// P3 by Ada
	cached, _ := loader.Load("u1").Get()
	fmt.Printf("cached u1: %s\n", cached.Name)
	// cached u1: Ada
	fmt.Printf("queries: %d\n", db.Queries)
	// queries: 1
	// [/client]
}
