from typing import Protocol


# [coffee]
class Coffee(Protocol):
    def cost(self) -> float: ...
    def description(self) -> str: ...
# [/coffee]


# [simpleCoffee]
class SimpleCoffee:
    def cost(self) -> float:
        return 2.0

    def description(self) -> str:
        return "Coffee"
# [/simpleCoffee]


# [coffeeDecorator]
# Abstract in intent (TS/C# mark it `abstract`): it has no abstract methods,
# so Python won't block CoffeeDecorator(...) — only subclasses are meant to
# be instantiated.
class CoffeeDecorator:
    def __init__(self, coffee: Coffee) -> None:
        self._coffee = coffee

    def cost(self) -> float:
        return self._coffee.cost()

    def description(self) -> str:
        return self._coffee.description()
# [/coffeeDecorator]


# [milkDecorator]
class MilkDecorator(CoffeeDecorator):
    def cost(self) -> float:
        return super().cost() + 0.5

    def description(self) -> str:
        return f"{super().description()} + milk"
# [/milkDecorator]


# [sugarDecorator]
class SugarDecorator(CoffeeDecorator):
    def cost(self) -> float:
        return super().cost() + 0.25

    def description(self) -> str:
        return f"{super().description()} + sugar"
# [/sugarDecorator]


# [usage]
# Usage
order: Coffee = SimpleCoffee()
order = MilkDecorator(order)
order = SugarDecorator(order)

print(order.description(), order.cost())  # "Coffee + milk + sugar" 2.75
# [/usage]
