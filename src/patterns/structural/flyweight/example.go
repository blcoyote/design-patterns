package main

import (
	"fmt"
	"math/rand/v2"
)

// [canvas]
type Canvas interface {
	PaintTree(color, texture string, x, y, age float64)
}

// [/canvas]

// [treeType]
type TreeType interface {
	Draw(canvas Canvas, x, y, age float64)
}

// [/treeType]

// [concreteType]
// Immutable by construction: the fields are unexported and there are no
// setters, so the one instance shared by thousands of trees cannot be
// changed through its methods.
type ConcreteTreeType struct {
	// Intrinsic state: shared and identical for every tree of this species.
	name    string
	color   string
	texture string
}

// [draw]
func (t *ConcreteTreeType) Draw(canvas Canvas, x, y, age float64) {
	// Extrinsic state (x, y, age) arrives as arguments — it is never stored here.
	canvas.PaintTree(t.color, t.texture, x, y, age)
}

// [/draw]

// [/concreteType]

// [factory]
type TreeTypeFactory struct {
	pool map[string]*ConcreteTreeType
}

func NewTreeTypeFactory() *TreeTypeFactory {
	return &TreeTypeFactory{pool: map[string]*ConcreteTreeType{}}
}

// [getTreeType]
func (f *TreeTypeFactory) GetTreeType(name, color, texture string) TreeType {
	key := fmt.Sprintf("%s:%s:%s", name, color, texture)
	treeType, ok := f.pool[key]
	if !ok {
		treeType = &ConcreteTreeType{name: name, color: color, texture: texture} // cache miss — build once
		f.pool[key] = treeType
	}
	return treeType // cache hit — reuse the existing flyweight
}

// [/getTreeType]

func (f *TreeTypeFactory) PoolSize() int {
	return len(f.pool)
}

// [/factory]

// [tree]
type Tree struct {
	// Extrinsic state: unique per tree, stored outside the flyweight.
	x, y, age float64
	// [holds]
	treeType TreeType // shared reference, not a private copy
	// [/holds]
}

// [treeDraw]
func (t *Tree) Render(canvas Canvas) {
	t.treeType.Draw(canvas, t.x, t.y, t.age)
}

// [/treeDraw]

// [/tree]

// [forest]
type Forest struct {
	trees   []*Tree
	factory *TreeTypeFactory
}

func NewForest() *Forest {
	return &Forest{factory: NewTreeTypeFactory()}
}

// [plant]
func (f *Forest) Plant(x, y, age float64, name, color, texture string) {
	treeType := f.factory.GetTreeType(name, color, texture)
	f.trees = append(f.trees, &Tree{x: x, y: y, age: age, treeType: treeType})
}

// [/plant]

// [render]
func (f *Forest) Render(canvas Canvas) {
	for _, tree := range f.trees {
		tree.Render(canvas)
	}
}

// [/render]

func (f *Forest) TreeCount() int { return len(f.trees) }
func (f *Forest) TypeCount() int { return f.factory.PoolSize() }

// [/forest]

// [usage]
func main() {
	forest := NewForest()
	forest.Plant(120, 40, 3, "Oak", "#2f6b3a", "rough-bark.png")   // cache miss: builds the Oak type
	forest.Plant(340, 95, 7, "Oak", "#2f6b3a", "rough-bark.png")   // cache hit: same Oak instance
	forest.Plant(560, 70, 5, "Pine", "#1f4d2e", "needle-bark.png") // cache miss: builds the Pine type
	for i := 0; i < 4_998; i++ {
		forest.Plant(rand.Float64()*1000, rand.Float64()*1000, rand.Float64()*50, "Oak", "#2f6b3a", "rough-bark.png")
	}
	for i := 0; i < 4_999; i++ {
		forest.Plant(rand.Float64()*1000, rand.Float64()*1000, rand.Float64()*50, "Pine", "#1f4d2e", "needle-bark.png")
	}
	// 10,000 Tree objects on the heap (5,000 per species), backed by just two shared ConcreteTreeType instances
	fmt.Printf("%d trees, %d tree types\n", forest.TreeCount(), forest.TypeCount()) // 10000 trees, 2 tree types
}

// [/usage]
