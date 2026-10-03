package main

import "fmt"

// [component]
type FileSystemItem interface {
	GetSize() int
}

// [/component]

// [file]
type File struct {
	name string
	size int
}

func NewFile(name string, size int) *File {
	return &File{name: name, size: size}
}

func (f *File) GetSize() int {
	return f.size
}

// [/file]

// [folder]
type Folder struct {
	name     string
	children []FileSystemItem
}

func NewFolder(name string) *Folder {
	return &Folder{name: name}
}

func (f *Folder) Add(item FileSystemItem) {
	f.children = append(f.children, item)
}

func (f *Folder) GetSize() int {
	// Delegate to every child and combine — works whether each child
	// is a leaf File or another, deeper Folder.
	total := 0
	for _, child := range f.children {
		total += child.GetSize()
	}
	return total
}

// [/folder]

// [usage]
func main() {
	// [build]
	root := NewFolder("root")
	docs := NewFolder("docs")

	root.Add(docs)
	root.Add(NewFile("readme.md", 1100))
	docs.Add(NewFile("photo.jpg", 2400))
	docs.Add(NewFile("logo.png", 800))
	// [/build]

	// One call, regardless of how deep the tree underneath root actually is.
	fmt.Println(root.GetSize()) // 4300
}

// [/usage]
