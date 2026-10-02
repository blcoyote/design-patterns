// [coffee]
interface Coffee {
  cost(): number
  description(): string
}
// [/coffee]

// [simpleCoffee]
class SimpleCoffee implements Coffee {
  cost() {
    return 2.0
  }
  description() {
    return 'Coffee'
  }
}
// [/simpleCoffee]

// [coffeeDecorator]
abstract class CoffeeDecorator implements Coffee {
  constructor(protected coffee: Coffee) {}
  cost() {
    return this.coffee.cost()
  }
  description() {
    return this.coffee.description()
  }
}
// [/coffeeDecorator]

// [milkDecorator]
class MilkDecorator extends CoffeeDecorator {
  cost() {
    return super.cost() + 0.5
  }
  description() {
    return `${super.description()} + milk`
  }
}
// [/milkDecorator]

// [sugarDecorator]
class SugarDecorator extends CoffeeDecorator {
  cost() {
    return super.cost() + 0.25
  }
  description() {
    return `${super.description()} + sugar`
  }
}
// [/sugarDecorator]

// [usage]
// Usage
let order: Coffee = new SimpleCoffee()
order = new MilkDecorator(order)
order = new SugarDecorator(order)

console.log(order.description(), order.cost()) // "Coffee + milk + sugar" 2.75
// [/usage]
