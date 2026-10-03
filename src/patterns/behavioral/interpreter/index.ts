import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { InterpreterVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "interpreter",
  name: "Interpreter",
  category: "behavioral",
  order: 11,
  summary:
    "Represent a grammar as a class hierarchy, and interpret sentences in that language by walking the resulting tree.",
  intent:
    'Model a small language as a tree of classes, one per grammar rule, and evaluate a sentence by walking that tree.',
  problem:
    "Your application has expression trees for a small, well-defined language, such as arithmetic formulas, search filters or routing rules, and it needs to evaluate them. The set of rules keeps growing. If you evaluate the tree with one giant switch statement over every node type, the code gets brittle: adding a single new rule means hunting through nested conditionals to edit them.",
  solution:
    "Make every rule of the grammar a class that implements a shared Expression interface with one method, interpret(context). Terminal expressions (literals, variables) implement it directly. Non-terminal expressions (Add, Multiply, And, Or, ...) hold references to their own sub-expressions, interpret each child, and combine the results. A sentence in the language becomes a tree of these objects, and evaluating it means calling interpret() once on the root. The recursion that walks the grammar is spread across the classes instead of sitting in one function. Interpreter only covers this evaluation step. Turning source text into the tree (parsing) is a separate job that the pattern leaves to you. Here the client simply builds the tree by hand.",
  analogy:
    "Think of a calculator reading “x + (2 × 3)”. It doesn't swallow the whole formula at once. It splits it into an addition of two smaller formulas, each of which is a literal, a variable, or another smaller formula. It solves the smallest pieces first and combines the answers on the way back up.",
  whenToUse: [
    "The grammar is simple and fairly stable. Interpreter does not scale well to complex languages.",
    "Raw speed isn't critical, because a tree-walking interpreter is slower than a compiled or table-driven one.",
    "You'd rather represent each grammar rule as a class than hand-write one big evaluator function. (Parsing source text into the tree is a separate concern, outside the pattern.)",
  ],
  pros: [
    "Each grammar rule lives in its own class, so adding a rule means adding a class, not editing one big evaluator.",
    "The grammar becomes an object structure that you can build, inspect and reuse at runtime.",
    "Non-terminal expressions reuse Composite's recursive structure, so complex rules are built from simple ones for free.",
  ],
  cons: [
    "One class per grammar rule becomes unwieldy for anything beyond a small language.",
    "Deeply nested expressions mean a deep call stack, so large sentences can be slow and use a lot of stack.",
    "A tree of many tiny classes is harder to read and debug than one linear parsing function.",
  ],
  realWorld: [
    "GoF's own canonical example: compiling a regular-expression grammar into a tree of Literal/Sequence/Repetition expression objects",
    "SQL and spreadsheet formula engines evaluating expression trees",
    "Rule engines for feature flags, pricing or routing built from boolean/arithmetic expression trees",
    "Template languages that interpret a compiled node tree against render-time data",
  ],
  related: ["composite", "visitor", "iterator"],

  // Diagram (viewBox 800 × 500, x/y are box centres)
  viewBox: "0 0 800 500",
  participants: [
    {
      id: "expression",
      label: "Expression",
      role: "Abstract Expression",
      kind: "interface",
      x: 510,
      y: 36,
      width: 170,
      description:
        "Declares the one method every grammar rule must provide: interpret(context). Every class below — terminal or non-terminal — implements it, which is what lets Add and Multiply treat their children uniformly.",
    },
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 110,
      y: 110,
      description:
        "Builds the expression tree once — Variable('x') and Multiply(Number(2), Number(3)) wired together under an Add — then calls interpret(context) exactly once, on the root.",
      code: "usage",
    },
    {
      id: "context",
      label: "Context",
      role: "Context",
      kind: "object",
      x: 110,
      y: 370,
      description:
        "Holds the variable bindings available while interpreting — here just x: 5 — behind a single lookup(name) method. Only terminal expressions that need outside data (like VariableExpression) ever consult it.",
    },
    {
      id: "add",
      label: "Add",
      role: "Non-terminal · AddExpression",
      kind: "class",
      x: 430,
      y: 110,
      description:
        "The root of the tree and a non-terminal expression. It doesn't know how to add anything itself — it asks its left and right children to interpret themselves, then sums the two results.",
    },
    {
      id: "variableX",
      label: "Variable('x')",
      role: "Terminal · VariableExpression",
      kind: "class",
      x: 270,
      y: 260,
      description:
        "A terminal expression wrapping the name 'x'. It has no children, but unlike a literal it can't answer from itself — it asks the Context to look up the current value bound to 'x'.",
      code: "variable",
    },
    {
      id: "multiply",
      label: "Multiply",
      role: "Non-terminal · MultiplyExpression",
      kind: "class",
      x: 590,
      y: 260,
      description:
        "A non-terminal expression nested inside Add's right branch. Like Add, it has no value of its own: it delegates to its own left and right children and multiplies what comes back.",
    },
    {
      id: "numberTwo",
      label: "Number(2)",
      role: "Terminal · NumberExpression",
      kind: "class",
      x: 470,
      y: 400,
      description:
        "A terminal expression wrapping the literal value 2. It has no children and no dependency on the Context — interpret() just returns 2 immediately.",
      code: "number",
    },
    {
      id: "numberThree",
      label: "Number(3)",
      role: "Terminal · NumberExpression",
      kind: "class",
      x: 680,
      y: 400,
      description:
        "A terminal expression wrapping the literal value 3, structurally identical to Number(2) — it returns its own stored value with no delegation at all.",
      code: "number",
    },
  ],
  relations: [
    {
      id: "addImpl",
      from: "add",
      to: "expression",
      type: "implements",
      description: "AddExpression implements Expression.",
      bend: -20,
    },
    {
      id: "multiplyImpl",
      from: "multiply",
      to: "expression",
      type: "implements",
      description: "MultiplyExpression implements Expression.",
      bend: 20,
    },
    {
      id: "variableImpl",
      from: "variableX",
      to: "expression",
      type: "implements",
      description:
        "VariableExpression implements Expression, just like every other node in the tree.",
      bend: -40,
    },
    {
      id: "numberTwoImpl",
      from: "numberTwo",
      to: "expression",
      type: "implements",
      description: "NumberExpression implements Expression.",
      bend: 10,
    },
    {
      id: "numberThreeImpl",
      from: "numberThree",
      to: "expression",
      type: "implements",
      description: "NumberExpression implements Expression.",
      bend: 30,
    },
    {
      id: "newContext",
      from: "client",
      to: "context",
      type: "creates",
      label: "new Context()",
      description:
        "The client constructs a Context carrying the only binding the sentence needs: x = 5.",
      code: "newContext",
    },
    {
      id: "call",
      from: "client",
      to: "add",
      type: "calls",
      label: "interpret(context)",
      description:
        "The client interprets the whole sentence with one call — tree.interpret(context) — on the root Add node.",
      code: "usage",
    },
    {
      id: "addLeft",
      from: "add",
      to: "variableX",
      type: "holds",
      label: "left",
      description:
        "Add holds its left operand — the Variable('x') expression — and will ask it to interpret itself first.",
      code: "build",
    },
    {
      id: "addRight",
      from: "add",
      to: "multiply",
      type: "holds",
      label: "right",
      description:
        "Add holds its right operand — the nested Multiply expression — and will ask it to interpret itself too.",
      code: "build",
    },
    {
      id: "mulLeft",
      from: "multiply",
      to: "numberTwo",
      type: "holds",
      label: "left",
      description: "Multiply holds its left operand, the literal Number(2).",
      code: "build",
    },
    {
      id: "mulRight",
      from: "multiply",
      to: "numberThree",
      type: "holds",
      label: "right",
      description: "Multiply holds its right operand, the literal Number(3).",
      code: "build",
    },
    {
      id: "varLookup",
      from: "variableX",
      to: "context",
      type: "calls",
      label: 'lookup("x")',
      description:
        "VariableExpression has no value of its own, so interpreting it means asking the shared Context to look up 'x'.",
      bend: 30,
      code: "variable",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Build the tree",
      description:
        "The sentence “x + (2 × 3)” becomes a tree: Add at the root holds Variable('x') on its left and a Multiply on its right, which in turn holds Number(2) and Number(3).",
      highlight: [
        "add",
        "addLeft",
        "variableX",
        "addRight",
        "multiply",
        "mulLeft",
        "numberTwo",
        "mulRight",
        "numberThree",
      ],
      notes: { add: "left + right", multiply: "left × right" },
      code: "build",
    },
    {
      title: "A context supplies the bindings",
      description:
        "The client constructs a Context holding the one variable the sentence needs: x = 5. Only VariableExpression will ever touch it.",
      highlight: ["client", "newContext", "context"],
      packets: [{ relation: "newContext", label: "new Context({x: 5})" }],
      notes: { context: "x = 5" },
      code: "newContext",
    },
    {
      title: "Client calls interpret() on the root",
      description:
        "The client makes exactly one call — interpret(context) — on the root Add node. Everything from here happens inside the tree itself.",
      highlight: ["client", "call", "add"],
      packets: [{ relation: "call", label: "interpret(context)" }],
      code: "usage",
    },
    {
      title: "Add calls its left child first",
      description:
        "Add's interpret() adds its left child's result to its right child's — TypeScript, C#, Python and Go all evaluate the left operand before the right, so Add calls Variable('x') first and waits for its answer before touching Multiply at all.",
      highlight: ["add", "addLeft", "variableX"],
      packets: [{ relation: "addLeft", label: "interpret(context)" }],
      code: "add",
    },
    {
      title: "Variable asks the context for x, and gets 5 back",
      description:
        "Variable('x') has no stored value of its own, so interpreting it means asking the shared Context to look up the binding for 'x' — which answers immediately with 5.",
      highlight: ["variableX", "varLookup", "context", "addLeft", "add"],
      packets: [
        { relation: "varLookup", label: 'lookup("x")' },
        { relation: "varLookup", label: "5", reverse: true, after: 0 },
        { relation: "addLeft", label: "5", reverse: true, after: 1 },
      ],
      notes: { variableX: "5" },
      code: "variable",
    },
    {
      title: "Add calls its right child, Multiply",
      description:
        "Only now that its left operand has resolved does Add call interpret(context) on its right child, Multiply.",
      highlight: ["add", "addRight", "multiply"],
      packets: [{ relation: "addRight", label: "interpret(context)" }],
      code: "add",
    },
    {
      title: "Multiply delegates to its own children",
      description:
        "Multiply is non-terminal too, so it runs the same left-before-right logic as Add: it calls interpret(context) on Number(2), then on Number(3).",
      highlight: [
        "multiply",
        "mulLeft",
        "numberTwo",
        "mulRight",
        "numberThree",
      ],
      packets: [
        { relation: "mulLeft", label: "interpret(context)" },
        { relation: "mulRight", label: "interpret(context)", after: 0 },
      ],
      code: "multiply",
    },
    {
      title: "Leaves answer immediately",
      description:
        "Number(2) and Number(3) are terminals with no children, so they return their own literal values with no further delegation.",
      highlight: ["numberTwo", "mulLeft", "numberThree", "mulRight"],
      packets: [
        { relation: "mulLeft", label: "2", reverse: true },
        { relation: "mulRight", label: "3", reverse: true, after: 0 },
      ],
      notes: { numberTwo: "2", numberThree: "3" },
      code: "number",
    },
    {
      title: "Multiply combines and bubbles up",
      description:
        "Multiply now has both answers it was waiting for — 2 and 3 — multiplies them, and returns 6 back up to Add.",
      highlight: ["multiply", "addRight", "add"],
      packets: [{ relation: "addRight", label: "6", reverse: true }],
      notes: { multiply: "6" },
      code: "multiply",
    },
    {
      title: "Add combines and returns the final result",
      description:
        "Add adds its own two answers — 5 from Variable('x') and 6 from Multiply — for a final 11, and returns that single number to the client.",
      highlight: ["add", "call", "client"],
      packets: [{ relation: "call", label: "11", reverse: true }],
      notes: { add: "11", client: "result: 11" },
      code: "add",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,

  Visualization: InterpreterVisualization,
};
