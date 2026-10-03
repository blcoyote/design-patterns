from typing import Protocol


# [expression]
class Expression(Protocol):
    def interpret(self, context: "Context") -> float: ...
# [/expression]


# [context]
class Context:
    def __init__(self, bindings: dict[str, float]) -> None:
        self._bindings = bindings

    def lookup(self, name: str) -> float:
        value = self._bindings.get(name)
        # Fail loudly instead of letting an unbound name turn later arithmetic into a silent bug.
        if value is None:
            raise ValueError(f"Unbound variable: {name}")
        return value
# [/context]


# [number]
class NumberExpression:
    def __init__(self, value: float) -> None:
        self._value = value

    def interpret(self, context: Context) -> float:
        # Terminal: no children, so it answers immediately.
        return self._value
# [/number]


# [variable]
class VariableExpression:
    def __init__(self, name: str) -> None:
        self._name = name

    def interpret(self, context: Context) -> float:
        # Also terminal, but it answers by asking the Context instead of itself.
        return context.lookup(self._name)
# [/variable]


# [multiply]
class MultiplyExpression:
    def __init__(self, left: Expression, right: Expression) -> None:
        self._left = left
        self._right = right

    def interpret(self, context: Context) -> float:
        # Non-terminal: delegate to both children, then combine their answers.
        return self._left.interpret(context) * self._right.interpret(context)
# [/multiply]


# [add]
class AddExpression:
    def __init__(self, left: Expression, right: Expression) -> None:
        self._left = left
        self._right = right

    def interpret(self, context: Context) -> float:
        return self._left.interpret(context) + self._right.interpret(context)
# [/add]


# [usage]
# [build]
# x + (2 * 3)
tree: Expression = AddExpression(
    VariableExpression("x"),
    MultiplyExpression(NumberExpression(2), NumberExpression(3)),
)
# [/build]

# [newContext]
context = Context({"x": 5})
# [/newContext]

print(tree.interpret(context))  # 11
# [/usage]
