package main

import (
	"fmt"
	"sort"
	"strings"
)

// [components]
// Components are plain data: fields and nothing else, no methods. There is no Hero, Goblin
// or Tree type anywhere in this file; what an entity is follows from which components it
// has. Positions are integers on a one-dimensional track.

type Name struct{ Value string }
type Position struct{ X int }
type Velocity struct{ DX int }
type Health struct{ HP int }

// Hazard is the damage dealt each tick to every entity with Health that stands at the same x.
type Hazard struct{ Damage int }

// [/components]

// [world]
// Store holds one component type, keyed by entity id. The values are pointers, so a system
// that fetches a component can change it in place.
type Store[T any] map[int]*T

// Has reports whether the entity has a component in this store.
func (s Store[T]) Has(id int) bool {
	_, ok := s[id]
	return ok
}

// Len is how many entities have a component in this store.
func (s Store[T]) Len() int { return len(s) }

// Ids returns the entity ids in this store as a new slice. A Go map has no defined iteration
// order, so the order of the result is random: callers that need an order must sort it.
func (s Store[T]) Ids() []int {
	ids := make([]int, 0, len(s))
	for id := range s {
		ids = append(ids, id)
	}
	return ids
}

// Presence is what a query needs from a store. Only presence is checked, so the component
// type does not matter and every Store[T] fits.
type Presence interface {
	Has(id int) bool
	Len() int
	Ids() []int
}

// World is the world: it hands out entity ids and keeps one store per component type, keyed by
// entity id. An entity is only its id; it has no fields and no behaviour of its own.
//
// Real engines (Unity's Entities package, Bevy, EnTT, flecs) keep components in dense
// arrays, sparse sets or archetype tables so that iteration is cache friendly, and that
// speed is a main reason ECS exists. This example keeps one map per type and sorts the ids
// in every query, for clarity and so that all four languages print the same output. It is
// not meant to be fast.
type World struct {
	nextID     int
	Names      Store[Name]
	Positions  Store[Position]
	Velocities Store[Velocity]
	Healths    Store[Health]
	Hazards    Store[Hazard]
}

func NewWorld() *World {
	return &World{
		nextID:     1,
		Names:      Store[Name]{},
		Positions:  Store[Position]{},
		Velocities: Store[Velocity]{},
		Healths:    Store[Health]{},
		Hazards:    Store[Hazard]{},
	}
}

// Spawn returns the next entity id: 1, 2, 3, and so on.
func (w *World) Spawn() int {
	id := w.nextID
	w.nextID++
	return id
}

// Query returns the ids that are in ALL the given stores, in ascending numeric order. Only
// presence is checked, so the component type does not matter. The result is a new slice (a
// snapshot), so a system may destroy entities while it loops over it.
func (w *World) Query(stores ...Presence) []int {
	if len(stores) == 0 {
		return []int{}
	}
	ids := []int{}
	for _, id := range stores[0].Ids() {
		inAll := true
		for _, store := range stores[1:] {
			if !store.Has(id) {
				inAll = false
				break
			}
		}
		if inAll {
			ids = append(ids, id)
		}
	}
	// Map order is random, so sort: the same ids come back in the same order on every run.
	sort.Ints(ids)
	return ids
}

// NameOf returns the entity's name. A named entity is assumed here: a missing name is a
// programmer bug, so it panics.
func (w *World) NameOf(id int) string {
	name, ok := w.Names[id]
	if !ok {
		panic(fmt.Sprintf("entity %d has no Name", id))
	}
	return name.Value
}

// Destroy removes the id from every store, so the entity is gone.
func (w *World) Destroy(id int) {
	delete(w.Names, id)
	delete(w.Positions, id)
	delete(w.Velocities, id)
	delete(w.Healths, id)
	delete(w.Hazards, id)
}

// Count is how many entities have a component in the given store.
func (w *World) Count(store Presence) int {
	return store.Len()
}

// [/world]

// [movementSystem]
// movementSystem moves every entity that has both a Position and a Velocity. An entity with a
// Position only, like the tree at first, is not in the query result, so it never moves.
func movementSystem(world *World) {
	for _, id := range world.Query(world.Positions, world.Velocities) {
		position := world.Positions[id]
		velocity := world.Velocities[id]
		if position == nil || velocity == nil {
			continue
		}
		position.X += velocity.DX
	}
}

// [/movementSystem]

// [damageSystem]
// damageSystem: every hazard hurts every entity that has a Health and stands at the same x.
// Entities without Health are never touched, so a Position and a Hazard alone does nothing to
// them. Both loops run in ascending id order, and the hazard loop is nested inside the health
// loop.
func damageSystem(world *World) {
	for _, id := range world.Query(world.Positions, world.Healths) {
		position := world.Positions[id]
		health := world.Healths[id]
		if position == nil || health == nil {
			continue
		}
		for _, hazardID := range world.Query(world.Positions, world.Hazards) {
			hazardPosition := world.Positions[hazardID]
			hazard := world.Hazards[hazardID]
			if hazardPosition == nil || hazard == nil {
				continue
			}
			if hazardPosition.X != position.X {
				continue
			}
			health.HP -= hazard.Damage
			fmt.Printf("[damage] %s takes %d at %d (hp %d)\n",
				world.NameOf(id), hazard.Damage, position.X, health.HP)
		}
	}
}

// [/damageSystem]

// [deathSystem]
// deathSystem destroys every entity whose Health has dropped to zero or below.
func deathSystem(world *World) {
	// The query result is a snapshot, so destroying while looping is safe.
	for _, id := range world.Query(world.Healths) {
		health := world.Healths[id]
		if health == nil || health.HP > 0 {
			continue
		}
		name := world.NameOf(id)
		world.Destroy(id)
		fmt.Printf("[death] %s removed\n", name)
	}
}

// [/deathSystem]

// [gameLoop]
// systems are the systems, in the order a tick runs them. Here they run one after another on
// one thread, in this fixed order. Real schedulers (Bevy's, Unity's job system) may run systems
// in parallel when the components they touch do not conflict; this example does not show that
// and starts no goroutines.
var systems = []func(*World){movementSystem, damageSystem, deathSystem}

// tick is one tick of the game: every system runs once over the whole world.
func tick(world *World) {
	for _, system := range systems {
		system(world)
	}
}

// describe gives one line for the world: name@x for each named entity with a Position, plus
// its hp if it has Health.
func describe(world *World) string {
	parts := []string{}
	for _, id := range world.Query(world.Names, world.Positions) {
		position := world.Positions[id]
		if position == nil {
			panic(fmt.Sprintf("entity %d has no Position", id))
		}
		part := fmt.Sprintf("%s@%d", world.NameOf(id), position.X)
		if health := world.Healths[id]; health != nil {
			part += fmt.Sprintf(" hp%d", health.HP)
		}
		parts = append(parts, part)
	}
	return strings.Join(parts, ", ")
}

// [/gameLoop]

// [usage]
func main() {
	world := NewWorld()

	// Four entities. The hero and the goblin have the same set of components; the tree and the fire each have a different one.
	hero := world.Spawn()
	world.Names[hero] = &Name{Value: "hero"}
	world.Positions[hero] = &Position{X: 0}
	world.Velocities[hero] = &Velocity{DX: 1}
	world.Healths[hero] = &Health{HP: 10}

	goblin := world.Spawn()
	world.Names[goblin] = &Name{Value: "goblin"}
	world.Positions[goblin] = &Position{X: 5}
	world.Velocities[goblin] = &Velocity{DX: -1}
	world.Healths[goblin] = &Health{HP: 2}

	// The tree has a Name and a Position only: for now it cannot move, and it cannot be hurt.
	tree := world.Spawn()
	world.Names[tree] = &Name{Value: "tree"}
	world.Positions[tree] = &Position{X: 2}

	// The fire stands still and burns whatever with Health stands on it.
	fire := world.Spawn()
	world.Names[fire] = &Name{Value: "fire"}
	world.Positions[fire] = &Position{X: 3}
	world.Hazards[fire] = &Hazard{Damage: 2}

	for t := 1; t <= 3; t++ {
		tick(world)
		fmt.Printf("tick %d: %s\n", t, describe(world))
	}

	// Behaviour changes by adding data: with a Velocity the tree now matches the movement query.
	world.Velocities[tree] = &Velocity{DX: 1}
	fmt.Println("[world] tree gets Velocity(+1)")
	tick(world)
	fmt.Printf("tick 4: %s\n", describe(world))

	fmt.Printf("components: position %d, velocity %d, health %d, hazard %d, name %d\n",
		world.Count(world.Positions), world.Count(world.Velocities), world.Count(world.Healths),
		world.Count(world.Hazards), world.Count(world.Names))
}

// [/usage]
