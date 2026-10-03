from typing import Protocol


# [component]
class FileSystemItem(Protocol):
    def get_size(self) -> int: ...
# [/component]


# [file]
class File:
    def __init__(self, name: str, size: int) -> None:
        self._name = name
        self._size = size

    def get_size(self) -> int:
        return self._size
# [/file]


# [folder]
class Folder:
    def __init__(self, name: str) -> None:
        self._name = name
        self._children: list[FileSystemItem] = []

    def add(self, item: FileSystemItem) -> None:
        self._children.append(item)

    def get_size(self) -> int:
        # Delegate to every child and combine — works whether each child
        # is a leaf File or another, deeper Folder.
        return sum(child.get_size() for child in self._children)
# [/folder]


# [usage]
# [build]
root = Folder("root")
docs = Folder("docs")

root.add(docs)
root.add(File("readme.md", 1100))
docs.add(File("photo.jpg", 2400))
docs.add(File("logo.png", 800))
# [/build]

# One call, regardless of how deep the tree underneath root actually is.
print(root.get_size())  # 4300
# [/usage]
