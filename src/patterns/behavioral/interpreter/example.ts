// [expression]
interface Expression {
  interpret(context: Context): number;
}
// [/expression]

// [context]
class Context {
  constructor(private bindings: Record<string, number>) {}

  lookup(name: string): number {
    const value = this.bindings[name];
    // Fail loudly instead of letting undefined turn later arithmetic into NaN.
    if (value === undefined) throw new Error("Unbound variable: " + name);
    return value;
  }
}
// [/context]

// [number]
class NumberExpression implements Expression {
  constructor(private value: number) {}

  interpret(_context: Context): number {
    // Terminal: no children, so it answers immediately.
    return this.value;
  }
}
// [/number]

// [variable]
class VariableExpression implements Expression {
  constructor(private name: string) {}

  interpret(context: Context): number {
    // Also terminal, but it answers by asking the Context instead of itself.
    return context.lookup(this.name);
  }
}
// [/variable]

// [multiply]
class MultiplyExpression implements Expression {
  constructor(
    private left: Expression,
    private right: Expression,
  ) {}

  interpret(context: Context): number {
    // Non-terminal: delegate to both children, then combine their answers.
    return this.left.interpret(context) * this.right.interpret(context);
  }
}
// [/multiply]

// [add]
class AddExpression implements Expression {
  constructor(
    private left: Expression,
    private right: Expression,
  ) {}

  interpret(context: Context): number {
    return this.left.interpret(context) + this.right.interpret(context);
  }
}
// [/add]

// [usage]
// [build]
// x + (2 * 3)
const tree: Expression = new AddExpression(
  new VariableExpression("x"),
  new MultiplyExpression(new NumberExpression(2), new NumberExpression(3)),
);
// [/build]

// [newContext]
const context = new Context({ x: 5 });
// [/newContext]

console.log(tree.interpret(context)); // 11
// [/usage]
