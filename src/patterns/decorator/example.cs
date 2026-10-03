// [usage]
// Usage
ICoffee order = new SimpleCoffee();
order = new MilkDecorator(order);
order = new SugarDecorator(order);

Console.WriteLine($"{order.Description()} {order.Cost().ToString(System.Globalization.CultureInfo.InvariantCulture)}"); // "Coffee + milk + sugar" 2.75
// [/usage]

// [coffee]
interface ICoffee
{
    decimal Cost();
    string Description();
}
// [/coffee]

// [simpleCoffee]
class SimpleCoffee : ICoffee
{
    public decimal Cost() => 2.0m;
    public string Description() => "Coffee";
}
// [/simpleCoffee]

// [coffeeDecorator]
abstract class CoffeeDecorator(ICoffee coffee) : ICoffee
{
    public virtual decimal Cost() => coffee.Cost();
    public virtual string Description() => coffee.Description();
}
// [/coffeeDecorator]

// [milkDecorator]
class MilkDecorator(ICoffee coffee) : CoffeeDecorator(coffee)
{
    public override decimal Cost() => base.Cost() + 0.5m;
    public override string Description() => $"{base.Description()} + milk";
}
// [/milkDecorator]

// [sugarDecorator]
class SugarDecorator(ICoffee coffee) : CoffeeDecorator(coffee)
{
    public override decimal Cost() => base.Cost() + 0.25m;
    public override string Description() => $"{base.Description()} + sugar";
}
// [/sugarDecorator]
