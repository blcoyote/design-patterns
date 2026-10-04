// [usage]
// [build]
// x + (2 * 3)
IExpression tree = new AddExpression(
    new VariableExpression("x"),
    new MultiplyExpression(new NumberExpression(2), new NumberExpression(3))
);
// [/build]

// [newContext]
var context = new Context(new Dictionary<string, int> { ["x"] = 5 });
// [/newContext]

Console.WriteLine(tree.Interpret(context)); // 11
// [/usage]

// [expression]
interface IExpression
{
    int Interpret(Context context);
}
// [/expression]

// [context]
class Context(Dictionary<string, int> bindings)
{
    public int Lookup(string name)
    {
        // Fail with a clear "Unbound variable" message instead of a generic KeyNotFoundException.
        if (!bindings.TryGetValue(name, out var value)) throw new InvalidOperationException($"Unbound variable: {name}");
        return value;
    }
}
// [/context]

// [number]
class NumberExpression(int value) : IExpression
{
    public int Interpret(Context context)
    {
        // Terminal: no children, so it answers immediately.
        return value;
    }
}
// [/number]

// [variable]
class VariableExpression(string name) : IExpression
{
    public int Interpret(Context context)
    {
        // Also terminal, but it answers by asking the Context instead of itself.
        return context.Lookup(name);
    }
}
// [/variable]

// [multiply]
class MultiplyExpression(IExpression left, IExpression right) : IExpression
{
    public int Interpret(Context context)
    {
        // Non-terminal: delegate to both children, then combine their answers.
        return left.Interpret(context) * right.Interpret(context);
    }
}
// [/multiply]

// [add]
class AddExpression(IExpression left, IExpression right) : IExpression
{
    public int Interpret(Context context)
    {
        return left.Interpret(context) + right.Interpret(context);
    }
}
// [/add]
