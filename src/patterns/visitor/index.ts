import type { PatternDefinition } from '@/types/pattern'
import tsExample from './example.ts?raw'
import csExample from './example.cs?raw'
import pyExample from './example.py?raw'
import { VisitorVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'visitor',
  name: 'Visitor',
  category: 'behavioral',
  order: 10,
  summary: 'Separate an operation from the object structure it works on, so new operations never touch the elements.',
  intent:
    'Represent an operation to be performed on the elements of an object structure. Visitor lets you define a new operation without changing the classes of the elements it operates on.',
  problem:
    'A shape hierarchy — Circle, Rectangle, Group — needs several unrelated operations: total area, a JSON export, an SVG renderer, and more keep arriving. Putting each one as a method on every shape class bloats those classes with logic that has nothing to do with being a shape, and every new operation means editing every single element class all over again.',
  solution:
    'Give every element exactly one method, accept(visitor), that does nothing but call back into the visitor with its own concrete type: circle.accept(v) calls v.visitCircle(this). This is double dispatch — once on the element’s class via accept(), once on the visitor’s class via the matching visitX() method — and it is what lets the right operation/element pairing get picked without either side writing a single type check. New operations become new Visitor classes; the element classes never change again.',
  analogy:
    'A museum tour guide (the visitor) walks through rooms (the elements) that were built long before the guide existed. Each room only knows how to announce itself when the guide arrives (accept), and the guide reacts differently depending on which room it hears from — a painting gallery gets one commentary, a sculpture hall another — without any room needing to know anything about tours.',
  whenToUse: [
    'An object structure contains many unrelated classes, and you need several distinct operations across all of them.',
    'The classes in the structure rarely change, but you expect to add new operations often.',
    'The logic for an operation would otherwise be scattered across every element class, duplicating traversal code each time.',
  ],
  pros: [
    'Adding a new operation is just a new Visitor class — the element classes are never touched (Open/Closed).',
    'All the logic for one operation lives together in a single class instead of being spread across every element.',
    'Double dispatch resolves the right element/operation pairing without a single instanceof or switch statement.',
  ],
  cons: [
    'Adding a new element class means adding a visitXxx method to every existing visitor — the exact opposite trade-off from adding operations.',
    'Visitors often need access to an element’s internals, which can pressure you into weakening its encapsulation.',
    'The extra accept()/visit() indirection makes the call flow harder to follow than a plain virtual method call.',
  ],
  realWorld: [
    'Compiler ASTs: Roslyn\'s CSharpSyntaxVisitor and javac\'s TreeVisitor use true double dispatch (an accept() method per node type) to type-check, optimize, or generate code.',
    'ESLint and Babel plugins do visitor-style AST traversal, but dispatch by looking up node.type as a string key rather than by double dispatch.',
    'Serialization frameworks that add a new output format as a new visitor instead of new methods on every model class.',
  ],
  related: ['composite', 'iterator', 'interpreter'],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: 'element',
      label: 'Shape',
      role: 'Element interface',
      kind: 'interface',
      x: 250,
      y: 60,
      description: 'Declares accept(visitor), the single method every element implements. It is the only thing Circle, Rectangle and Group have in common.',
    },
    {
      id: 'visitor',
      label: 'ShapeVisitor',
      role: 'Visitor interface',
      kind: 'interface',
      x: 600,
      y: 60,
      width: 170,
      description:
        'Declares one visitX method per concrete element class — visitCircle, visitRectangle, visitGroup. This interface (and every existing visitor) has to grow when a new shape type arrives, the mirror image of how cheaply new operations can be added.',
    },
    {
      id: 'group',
      label: 'Group',
      role: 'Composite Element',
      kind: 'class',
      x: 250,
      y: 190,
      description:
        'Holds a list of child shapes and implements Shape itself, so a Group can contain Circles, Rectangles, or further nested Groups. Its accept() lets every child dispatch itself first, then calls visitor.visitGroup(this) for its own contribution.',
    },
    {
      id: 'circle',
      label: 'Circle',
      role: 'Concrete Element',
      kind: 'class',
      x: 120,
      y: 330,
      description: 'A leaf shape with just a radius. accept() does exactly one thing: call visitor.visitCircle(this) — it never contains area, export, or any other operation-specific logic itself.',
    },
    {
      id: 'rectangle',
      label: 'Rectangle',
      role: 'Concrete Element',
      kind: 'class',
      x: 380,
      y: 330,
      description: 'A leaf shape with a width and height. Like Circle, its accept() only forwards to the matching visitRectangle(this) call — the operation itself lives entirely in the visitor.',
    },
    {
      id: 'areaCalculator',
      label: 'AreaCalculator',
      role: 'Concrete Visitor',
      kind: 'class',
      x: 600,
      y: 190,
      width: 170,
      description: 'Implements ShapeVisitor to sum areas: π·r² for each circle, width × height for each rectangle. Its visitGroup does nothing extra — the children already added themselves in by the time it runs.',
    },
    {
      id: 'jsonExporter',
      label: 'JsonExporter',
      role: 'Concrete Visitor',
      kind: 'class',
      x: 600,
      y: 330,
      description: 'A second operation added later, purely as a new class — Circle, Rectangle and Group did not change by one line. Its visitGroup wraps whatever its children already exported into a single JSON object.',
    },
  ],
  relations: [
    {
      id: 'groupImpl',
      from: 'group',
      to: 'element',
      type: 'implements',
      description: 'Group implements Shape too — a composite element is still just an element from the outside.',
    },
    {
      id: 'circleImpl',
      from: 'circle',
      to: 'element',
      type: 'implements',
      description: 'Circle implements the Shape interface, promising nothing more than accept().',
      bend: -50,
    },
    {
      id: 'rectangleImpl',
      from: 'rectangle',
      to: 'element',
      type: 'implements',
      description: 'Rectangle implements Shape the same minimal way Circle does.',
      bend: 50,
    },
    {
      id: 'areaCalcImpl',
      from: 'areaCalculator',
      to: 'visitor',
      type: 'implements',
      description: "AreaCalculator implements every visitX method ShapeVisitor declares — one per concrete element class.",
    },
    {
      id: 'jsonExpImpl',
      from: 'jsonExporter',
      to: 'visitor',
      type: 'implements',
      description: 'JsonExporter implements the same interface with a completely different operation inside each method.',
      bend: -60,
    },
    {
      id: 'holdsCircle',
      from: 'group',
      to: 'circle',
      type: 'holds',
      label: 'children[]',
      description: 'Group holds Circle as one of its children, to be visited whenever the group itself is.',
      bend: -15,
      code: 'build',
    },
    {
      id: 'holdsRectangle',
      from: 'group',
      to: 'rectangle',
      type: 'holds',
      label: 'children[]',
      description: 'Group holds Rectangle as its other child, alongside Circle.',
      bend: 15,
      code: 'build',
    },
    {
      id: 'enterCircle',
      from: 'group',
      to: 'circle',
      type: 'calls',
      label: 'accept(v)',
      description: "Hop 1 of double dispatch: Group's accept() loop reaches Circle and calls circle.accept(visitor) — Circle decides what happens next, not Group.",
      bend: 15,
      code: 'groupAccept',
    },
    {
      id: 'dispatchCircle',
      from: 'circle',
      to: 'visitor',
      type: 'calls',
      label: 'visitCircle(this)',
      description: "Hop 2: inside its own accept(), Circle calls back into the visitor with visitCircle(this) — the visitor's concrete class decides what a circle means.",
      bend: -70,
      code: 'visitCircleMethod',
    },
    {
      id: 'enterRectangle',
      from: 'group',
      to: 'rectangle',
      type: 'calls',
      label: 'accept(v)',
      description: 'Hop 1 again: the same loop reaches Rectangle next and calls rectangle.accept(visitor).',
      bend: -15,
      code: 'groupAccept',
    },
    {
      id: 'dispatchRectangle',
      from: 'rectangle',
      to: 'visitor',
      type: 'calls',
      label: 'visitRectangle(this)',
      description: "Hop 2 for Rectangle: it calls visitRectangle(this) — the same call site in Group, a different method resolved entirely by Rectangle's own type.",
      bend: 40,
      code: 'visitRectangleMethod',
    },
    {
      id: 'groupDispatch',
      from: 'group',
      to: 'visitor',
      type: 'calls',
      label: 'visitGroup(this)',
      description: 'After every child has dispatched itself, Group performs its own double dispatch by calling visitor.visitGroup(this).',
      bend: 20,
      code: 'visitGroupMethod',
    },
  ],

  // Animated scenario
  steps: [
    {
      title: 'Build the object structure',
      description:
        'A Group holds a Circle and a Rectangle as children. Group, Circle and Rectangle all implement the same Shape interface — any mix of leaves or nested groups is just another Shape to work with.',
      highlight: ['group', 'groupImpl', 'holdsCircle', 'circle', 'circleImpl', 'holdsRectangle', 'rectangle', 'rectangleImpl'],
      notes: { group: 'children: 2' },
      code: 'build',
    },
    {
      title: 'Two operations are ready, unused',
      description:
        'AreaCalculator and JsonExporter both implement ShapeVisitor. Neither Circle, Rectangle nor Group has ever heard of either one — they only know about accept().',
      highlight: ['visitor', 'areaCalcImpl', 'areaCalculator', 'jsonExpImpl', 'jsonExporter'],
      notes: { areaCalculator: 'idle', jsonExporter: 'idle' },
      code: 'visitor',
    },
    {
      title: 'AreaCalculator is picked as the active visitor',
      description:
        'Something external calls group.accept(areaCalculator) — the same single entry point Group would accept any visitor through, whichever operation it represents.',
      highlight: ['group', 'areaCalculator'],
      notes: { group: 'accept(calculator)' },
      code: 'groupAccept',
    },
    {
      title: 'Hop 1: Group forwards to Circle',
      description:
        "Group's accept() loop reaches Circle first and calls circle.accept(visitor) — Group hands the visitor off without knowing what Circle will do with it.",
      highlight: ['enterCircle', 'circle'],
      packets: [{ relation: 'enterCircle', label: 'accept(v)' }],
      notes: { circle: 'dispatching…' },
      code: 'groupAccept',
    },
    {
      title: 'Hop 2: Circle calls back the matching method',
      description:
        'Inside its own accept(), Circle calls visitor.visitCircle(this). The two dispatches together pick the pair that runs: Circle’s own type picked the visitCircle method name, and the visitor’s concrete class — AreaCalculator — picks which implementation of it executes.',
      highlight: ['dispatchCircle', 'areaCalculator'],
      packets: [{ relation: 'dispatchCircle', label: 'visitCircle(this)' }],
      notes: { areaCalculator: '+28.27' },
      code: 'visitCircleMethod',
    },
    {
      title: 'Hop 1: Group forwards to Rectangle',
      description: 'The loop continues to the next child. Group calls rectangle.accept(visitor) — the exact same call it just made on Circle.',
      highlight: ['enterRectangle', 'rectangle'],
      packets: [{ relation: 'enterRectangle', label: 'accept(v)' }],
      notes: { rectangle: 'dispatching…' },
      code: 'groupAccept',
    },
    {
      title: 'Hop 2: Rectangle calls back a different method',
      description:
        'Rectangle calls visitor.visitRectangle(this). Same call site in Group, same accept() shape, but a different method runs — this time the rectangle-specific branch of AreaCalculator.',
      highlight: ['dispatchRectangle', 'areaCalculator'],
      packets: [{ relation: 'dispatchRectangle', label: 'visitRectangle(this)' }],
      notes: { areaCalculator: '40.27' },
      code: 'visitRectangleMethod',
    },
    {
      title: 'Group dispatches on itself, too',
      description:
        'Once every child has been visited, Group calls visitor.visitGroup(this) for its own contribution. AreaCalculator has nothing left to add — the children already summed themselves in.',
      highlight: ['groupDispatch', 'areaCalculator'],
      packets: [{ relation: 'groupDispatch', label: 'visitGroup(this)' }],
      notes: { areaCalculator: 'total 40.27' },
      code: 'visitGroupMethod',
    },
    {
      title: 'A second operation, no element changed',
      description:
        'Swapping in JsonExporter and running the exact same tour produces a JSON string instead of a number — Circle, Rectangle and Group never noticed the difference.',
      highlight: ['jsonExporter', 'jsonExpImpl'],
      notes: { jsonExporter: 'ready' },
      code: 'jsonExporter',
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  Visualization: VisitorVisualization,
}
