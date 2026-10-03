// [component]
interface FileSystemItem {
  getSize(): number;
}
// [/component]

// [file]
class File implements FileSystemItem {
  constructor(
    private name: string,
    private size: number,
  ) {}

  getSize(): number {
    return this.size;
  }
}
// [/file]

// [folder]
class Folder implements FileSystemItem {
  private children: FileSystemItem[] = [];

  constructor(private name: string) {}

  add(item: FileSystemItem): void {
    this.children.push(item);
  }

  getSize(): number {
    // Delegate to every child and combine — works whether each child
    // is a leaf File or another, deeper Folder.
    return this.children.reduce((total, child) => total + child.getSize(), 0);
  }
}
// [/folder]

// [usage]
// [build]
const root = new Folder("root");
const docs = new Folder("docs");

root.add(docs);
root.add(new File("readme.md", 1100));
docs.add(new File("photo.jpg", 2400));
docs.add(new File("logo.png", 800));
// [/build]

// One call, regardless of how deep the tree underneath root actually is.
console.log(root.getSize()); // 4300
// [/usage]
