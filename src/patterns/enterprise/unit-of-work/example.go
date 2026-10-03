package main

import (
	"fmt"
	"slices"
)

// Entities are tracked by pointer, so identity comparison (==) on *Entity
// matches the reference tracking of the other languages.
type Entity struct {
	ID string
}

// Go has no try/catch, so the write methods return an error and Commit
// rolls back when one fails.
type Database interface {
	BeginTransaction()
	Insert(entity *Entity) error
	Update(entity *Entity) error
	Delete(entity *Entity) error
	CommitTransaction()
	RollbackTransaction()
}

// [database]
type SqlDatabase struct{}

func (SqlDatabase) BeginTransaction() {
	fmt.Println("BEGIN")
}

func (SqlDatabase) Insert(entity *Entity) error {
	fmt.Printf("INSERT %s\n", entity.ID)
	return nil
}

func (SqlDatabase) Update(entity *Entity) error {
	fmt.Printf("UPDATE %s\n", entity.ID)
	return nil
}

func (SqlDatabase) Delete(entity *Entity) error {
	fmt.Printf("DELETE %s\n", entity.ID)
	return nil
}

func (SqlDatabase) CommitTransaction() {
	fmt.Println("COMMIT")
}

func (SqlDatabase) RollbackTransaction() {
	fmt.Println("ROLLBACK")
}

// [/database]

// [unitOfWork]
type UnitOfWork struct {
	// [pendingNew]
	newObjects []*Entity
	// [/pendingNew]
	// [pendingDirty]
	dirtyObjects []*Entity
	// [/pendingDirty]
	// [pendingRemoved]
	removedObjects []*Entity
	// [/pendingRemoved]
	db Database
}

func NewUnitOfWork(db Database) *UnitOfWork {
	return &UnitOfWork{db: db}
}

// [register]
// Note: entities are tracked by reference (slices.Contains compares the
// *Entity pointers with ==), so the very same pointer must be passed to every
// Register*() call for an entity. Real Unit of Work implementations pair this
// with an Identity Map so a given row only ever has one in-memory instance to
// begin with.

// [registerNew]
func (u *UnitOfWork) RegisterNew(entity *Entity) {
	// Guards against double-registering the same still-unsaved entity as new.
	if !slices.Contains(u.newObjects, entity) {
		u.newObjects = append(u.newObjects, entity)
	}
}

// [/registerNew]

// [registerDirty]
func (u *UnitOfWork) RegisterDirty(entity *Entity) {
	// Skips entities already queued as new (nothing to UPDATE yet) or already
	// marked dirty (no point queuing the same UPDATE twice).
	alreadyTracked := slices.Contains(u.newObjects, entity) || slices.Contains(u.dirtyObjects, entity)
	if !alreadyTracked {
		u.dirtyObjects = append(u.dirtyObjects, entity)
	}
}

// [/registerDirty]

// [registerRemoved]
func (u *UnitOfWork) RegisterRemoved(entity *Entity) {
	wasNew := slices.Contains(u.newObjects, entity)
	// Whatever it was before, there is nothing left to insert or update.
	isOther := func(e *Entity) bool { return e == entity }
	u.newObjects = slices.DeleteFunc(u.newObjects, isOther)
	u.dirtyObjects = slices.DeleteFunc(u.dirtyObjects, isOther)
	// A row that was never inserted has nothing to delete.
	if !wasNew && !slices.Contains(u.removedObjects, entity) {
		u.removedObjects = append(u.removedObjects, entity)
	}
}

// [/registerRemoved]
// [/register]

// [commit]
func (u *UnitOfWork) Commit() error {
	u.db.BeginTransaction()
	// One statement per entity, in order: this example trades round trips
	// for simplicity. The atomicity guarantee comes from the single
	// transaction wrapping all of them, not from how many statements it took
	// to get there — a real ORM can batch these into fewer round trips.
	for _, entity := range u.newObjects {
		if err := u.db.Insert(entity); err != nil {
			u.db.RollbackTransaction() // none of the writes above take effect
			return err
		}
	}
	for _, entity := range u.dirtyObjects {
		if err := u.db.Update(entity); err != nil {
			u.db.RollbackTransaction() // none of the writes above take effect
			return err
		}
	}
	for _, entity := range u.removedObjects {
		if err := u.db.Delete(entity); err != nil {
			u.db.RollbackTransaction() // none of the writes above take effect
			return err
		}
	}
	u.db.CommitTransaction()
	u.newObjects = nil
	u.dirtyObjects = nil
	u.removedObjects = nil
	return nil
}

// [/commit]

// [/unitOfWork]

func main() {
	// [client]
	db := SqlDatabase{}
	uow := NewUnitOfWork(db)

	order := &Entity{"order-104"}
	customer := &Entity{"customer-58"}
	cart := &Entity{"cart-9"}

	uow.RegisterNew(order)
	uow.RegisterDirty(customer)
	uow.RegisterRemoved(cart)
	uow.RegisterDirty(customer) // already tracked — ignored

	uow.Commit()
	// BEGIN
	// INSERT order-104
	// UPDATE customer-58
	// DELETE cart-9
	// COMMIT
	// [/client]
}
