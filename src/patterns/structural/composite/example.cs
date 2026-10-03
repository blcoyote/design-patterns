// [usage]
// [build]
var root = new Folder("root");
var docs = new Folder("docs");

root.Add(docs);
root.Add(new File("readme.md", 1100));
docs.Add(new File("photo.jpg", 2400));
docs.Add(new File("logo.png", 800));
// [/build]

// One call, regardless of how deep the tree underneath root actually is.
Console.WriteLine(root.GetSize()); // 4300
// [/usage]

// [component]
interface IFileSystemItem
{
    int GetSize();
}
// [/component]

// [file]
class File(string name, int size) : IFileSystemItem
{
    public string Name { get; } = name;
    public int GetSize() => size;
}
// [/file]

// [folder]
class Folder(string name) : IFileSystemItem
{
    public string Name { get; } = name;
    private readonly List<IFileSystemItem> _children = new();

    public void Add(IFileSystemItem item)
    {
        _children.Add(item);
    }

    public int GetSize()
    {
        // Delegate to every child and combine — works whether each child
        // is a leaf File or another, deeper Folder.
        return _children.Sum(child => child.GetSize());
    }
}
// [/folder]
