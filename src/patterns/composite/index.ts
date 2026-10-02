import type { PatternDefinition } from '@/types/pattern'
import { CompositeVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'composite',
  name: 'Composite',
  category: 'structural',
  order: 5,
  summary: 'Compose objects into trees, then treat a single leaf and an entire subtree the same way.',
  intent:
    'Compose objects into tree structures to represent part-whole hierarchies. Composite lets clients treat individual objects and compositions of objects uniformly.',
  problem:
    'A file system (or a UI menu, or an org chart) mixes single items with groups of items, and a group can itself contain more groups, nested to any depth. Code that has to ask "is this one file, or a whole folder?" at every call site fills up with type checks and breaks the moment another level of nesting appears.',
  solution:
    'Give leaves and containers the same interface — one operation, like getSize(). A Leaf implements it directly, returning its own value. A Composite implements the exact same method by looping over its children and delegating to each one, combining their results. The client only ever calls the one method on the one interface, whether it is holding a single file or an entire directory tree — the recursion is hidden inside the composites themselves.',
  analogy:
    'An org chart: asking "what is this team\'s headcount?" works the same way whether you ask an individual contributor (the answer is 1) or a manager, who asks each of their direct reports the same question and adds up the answers — some of whom are themselves managers asking further down the chain.',
  whenToUse: [
    'You need to represent part-whole hierarchies of objects as a tree.',
    'You want client code to treat individual objects and compositions of them identically.',
    'The structure can be nested to an arbitrary, unknown depth.',
  ],
  pros: [
    'Client code stays simple: one interface, no `if (isLeaf) … else …` branching.',
    'Open/Closed: new kinds of leaves or composites slot in without touching existing code.',
    'Makes building and traversing arbitrarily deep, recursive structures easy.',
  ],
  cons: [
    'Can make the design overly general — hard to restrict what a composite may legally contain.',
    'Operations that only make sense on containers (add/remove a child) are awkward or unsafe on leaves.',
    'Very deep trees mean a recursive call chain all the way down, which costs stack frames and time.',
  ],
  realWorld: [
    'File systems: directories and files share one interface (size, delete, search…)',
    'DOM / UI widget trees: a container element and a leaf widget both implement render()',
    'GUI menus: a menu holds menu items and other (sub)menus behind the same interface',
    'Bill-of-materials and org-chart trees that total cost or headcount recursively',
  ],
  related: ['decorator', 'iterator', 'visitor', 'interpreter', 'flyweight'],
  participants: [
    {
      id: 'component',
      label: 'FileSystemItem',
      role: 'Component interface',
      kind: 'interface',
      x: 400,
      y: 50,
      width: 180,
      description: 'Declares the single getSize() operation. Every leaf and every composite implements it, so callers never need to know which kind they are holding.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 690,
      y: 150,
      description: 'Holds a reference typed only as FileSystemItem and calls getSize() on it once — it has no idea whether that hits one file or an entire tree.',
    },
    {
      id: 'root',
      label: 'root/',
      role: 'Composite',
      kind: 'class',
      x: 400,
      y: 170,
      description: 'The top-level folder. Implements getSize() by summing the size of every child it directly holds: the docs/ folder and readme.md.',
    },
    {
      id: 'docs',
      label: 'docs/',
      role: 'Composite',
      kind: 'class',
      x: 270,
      y: 290,
      description: 'A folder nested inside root/. It is itself a composite — it holds its own children (photo.jpg and logo.png) and sums their sizes the same way root/ does.',
    },
    {
      id: 'readme',
      label: 'readme.md',
      role: 'Leaf',
      kind: 'class',
      x: 540,
      y: 290,
      description: 'A plain file directly inside root/. As a leaf it has no children — getSize() just returns its own stored size immediately.',
    },
    {
      id: 'photo',
      label: 'photo.jpg',
      role: 'Leaf',
      kind: 'class',
      x: 185,
      y: 400,
      description: 'A file inside docs/. A leaf with no children of its own — getSize() returns its own size directly.',
    },
    {
      id: 'logo',
      label: 'logo.png',
      role: 'Leaf',
      kind: 'class',
      x: 365,
      y: 400,
      description: 'A second file inside docs/, sitting alongside photo.jpg. Also a leaf — it returns its own size with no further recursion.',
    },
  ],
  relations: [
    {
      id: 'call',
      from: 'client',
      to: 'root',
      type: 'calls',
      label: 'getSize()',
      description: 'The client calls getSize() exactly once, on the root item — the same call it would make on a single, standalone file.',
      code: 'usage',
    },
    {
      id: 'rootImpl',
      from: 'root',
      to: 'component',
      type: 'implements',
      description: 'root/ implements FileSystemItem like everything else in the tree.',
      code: 'folder',
    },
    {
      id: 'readmeImpl',
      from: 'readme',
      to: 'component',
      type: 'implements',
      description: 'readme.md implements the very same FileSystemItem interface, even though it is a leaf with no children.',
      bend: 70,
      code: 'file',
    },
    {
      id: 'rootDocs',
      from: 'root',
      to: 'docs',
      type: 'holds',
      label: 'children[]',
      description: 'root/ holds a reference to docs/ in its children array — this is the structural containment edge the recursion walks down.',
      code: 'build',
    },
    {
      id: 'rootReadme',
      from: 'root',
      to: 'readme',
      type: 'holds',
      label: 'children[]',
      description: 'root/ also directly holds readme.md as a child, alongside the docs/ folder.',
      code: 'build',
    },
    {
      id: 'docsPhoto',
      from: 'docs',
      to: 'photo',
      type: 'holds',
      label: 'children[]',
      description: 'docs/ holds photo.jpg as one of its own children.',
      code: 'build',
    },
    {
      id: 'docsLogo',
      from: 'docs',
      to: 'logo',
      type: 'holds',
      label: 'children[]',
      description: 'docs/ holds logo.png as its other child, completing the tree.',
      code: 'build',
    },
  ],
  steps: [
    {
      title: 'Build the tree',
      description: 'root/ holds docs/ and readme.md as direct children. docs/ in turn holds photo.jpg and logo.png — a tree, nested two levels deep.',
      highlight: ['root', 'rootDocs', 'docs', 'rootReadme', 'readme', 'docsPhoto', 'photo', 'docsLogo', 'logo'],
      notes: { root: 'children: 2', docs: 'children: 2' },
      code: 'build',
    },
    {
      title: 'Client calls getSize()',
      description: 'The client calls getSize() once, on root/ — the exact same call it would make if root/ were a single file instead of a whole tree.',
      highlight: ['client', 'call', 'root'],
      packets: [{ relation: 'call', label: 'getSize()' }],
      code: 'usage',
    },
    {
      title: 'The call ripples down to root’s children',
      description: 'root/ does not know how to measure itself directly — it loops over its children and calls getSize() on each one: docs/ and readme.md.',
      highlight: ['root', 'rootDocs', 'docs', 'rootReadme', 'readme'],
      packets: [
        { relation: 'rootDocs', label: 'getSize()' },
        { relation: 'rootReadme', label: 'getSize()' },
      ],
      code: 'folder',
    },
    {
      title: 'docs/ ripples the call further down',
      description: 'docs/ is itself a composite, so it runs the exact same logic as root/: it calls getSize() on each of its own children, photo.jpg and logo.png.',
      highlight: ['docs', 'docsPhoto', 'photo', 'docsLogo', 'logo'],
      packets: [
        { relation: 'docsPhoto', label: 'getSize()' },
        { relation: 'docsLogo', label: 'getSize()' },
      ],
      code: 'folder',
    },
    {
      title: 'Leaves hit bottom and answer immediately',
      description: 'photo.jpg, logo.png and readme.md have no children to delegate to — each one just returns its own stored size, right away.',
      highlight: ['photo', 'docsPhoto', 'logo', 'docsLogo', 'readme', 'rootReadme'],
      packets: [
        { relation: 'docsPhoto', label: '2.4 MB', reverse: true },
        { relation: 'docsLogo', label: '0.8 MB', reverse: true },
        { relation: 'rootReadme', label: '1.1 MB', reverse: true },
      ],
      notes: { photo: '2.4 MB', logo: '0.8 MB', readme: '1.1 MB' },
      code: 'file',
    },
    {
      title: 'docs/ totals its children and bubbles up',
      description: 'docs/ adds 2.4 MB + 0.8 MB from its two children and returns that 3.2 MB subtotal back up to root/.',
      highlight: ['docs', 'rootDocs', 'root'],
      packets: [{ relation: 'rootDocs', label: '3.2 MB', reverse: true }],
      notes: { docs: '3.2 MB' },
      code: 'folder',
    },
    {
      title: 'root/ totals everything and returns to the client',
      description: 'root/ adds the 3.2 MB subtotal from docs/ to readme.md’s 1.1 MB, for a grand total of 4.3 MB, and returns that single number to the client.',
      highlight: ['root', 'call', 'client'],
      packets: [{ relation: 'call', label: '4.3 MB', reverse: true }],
      notes: { root: '4.3 MB' },
      code: 'folder',
    },
    {
      title: 'One call, whole tree measured',
      description: 'The client made a single getSize() call and got back the total size of an entire nested tree — it never had to know how deep that tree went.',
      highlight: ['client'],
      notes: { client: 'total: 4.3 MB' },
      code: 'usage',
    },
  ],
  code: `
// [component]
interface FileSystemItem {
  getSize(): number
}
// [/component]

// [file]
class File implements FileSystemItem {
  constructor(private name: string, private size: number) {}

  getSize(): number {
    return this.size
  }
}
// [/file]

// [folder]
class Folder implements FileSystemItem {
  private children: FileSystemItem[] = []

  constructor(private name: string) {}

  add(item: FileSystemItem): void {
    this.children.push(item)
  }

  getSize(): number {
    // Delegate to every child and combine — works whether each child
    // is a leaf File or another, deeper Folder.
    return this.children.reduce((total, child) => total + child.getSize(), 0)
  }
}
// [/folder]

// [usage]
// [build]
const root = new Folder('root')
const docs = new Folder('docs')

root.add(docs)
root.add(new File('readme.md', 1.1))
docs.add(new File('photo.jpg', 2.4))
docs.add(new File('logo.png', 0.8))
// [/build]

// One call, regardless of how deep the tree underneath root actually is.
console.log(root.getSize()) // 4.3
// [/usage]
`,
  Visualization: CompositeVisualization,
}
