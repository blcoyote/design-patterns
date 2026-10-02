import type { PatternDefinition } from '@/types/pattern'
import { DecoratorVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'decorator',
  name: 'Decorator',
  category: 'structural',
  order: 2,
  summary: 'Attach new behaviour to an object by wrapping it, layer by layer.',
  intent:
    'Attach additional responsibilities to an object dynamically. Decorators provide a flexible alternative to subclassing for extending functionality.',
  problem:
    'A coffee shop sells a base coffee, but customers can add milk, sugar, whipped cream, or any combination, in any order. Subclassing every combination (MilkCoffee, MilkSugarCoffee, SugarWhipCoffee…) explodes combinatorially and has to be fixed at compile time.',
  solution:
    'Give every add-on the same interface as the thing it decorates, and have each decorator hold a reference to the object it wraps. Calling a method on the outermost decorator runs its own logic and then delegates to the wrapped object — forming a chain that can be built at runtime, in any order, to any depth. This is different from Proxy, which controls access to or the lifecycle of a single subject it is usually responsible for creating; a decorator is simply handed a wrappee and only ever adds behaviour around it.',
  analogy:
    'Dressing for cold weather: a shirt, then a sweater over it, then a coat over that. Each layer adds warmth without changing the layers underneath, and you can put on (or take off) exactly the layers you need.',
  whenToUse: [
    'You need to add responsibilities to individual objects, not to every instance of a class.',
    'Subclassing would produce an explosion of classes for every combination of features.',
    'You want to add or remove behaviour at runtime instead of compile time.',
  ],
  pros: [
    'More flexible than static inheritance — combine behaviours at runtime.',
    'Avoids a class-per-combination explosion.',
    'Single Responsibility: each decorator handles one concern.',
  ],
  cons: [
    'Many small objects that look similar can be hard to debug.',
    'Order of wrapping matters and can be easy to get wrong.',
    'Removing a specific decorator from the middle of a stack is awkward.',
  ],
  realWorld: [
    'Java I/O: BufferedInputStream wrapping a FileInputStream to add buffering',
    '.NET streams: GZipStream or BufferedStream wrapping any Stream to add compression or buffering',
    'UI component libraries wrapping a component with tooltip/draggable/resizable behaviour',
    'HTTP middleware chains wrapping a request handler',
  ],
  related: ['adapter', 'composite', 'facade', 'proxy', 'strategy'],
  participants: [
    {
      id: 'coffee',
      label: 'Coffee',
      role: 'Component interface',
      kind: 'interface',
      x: 400,
      y: 70,
      description: 'Declares cost() and description(), implemented by both the base coffee and every decorator.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 660,
      y: 150,
      description: 'Builds a stack of decorators around a base coffee, then calls cost() on the outermost one.',
    },
    {
      id: 'sugarDecorator',
      label: 'SugarDecorator',
      role: 'Concrete Decorator',
      kind: 'class',
      x: 560,
      y: 260,
      description: 'Adds $0.25 to the wrapped cost and "+ sugar" to the description, then returns.',
    },
    {
      id: 'milkDecorator',
      label: 'MilkDecorator',
      role: 'Concrete Decorator',
      kind: 'class',
      x: 350,
      y: 260,
      description: 'Adds $0.50 to the wrapped cost and "+ milk" to the description, then returns.',
    },
    {
      id: 'simpleCoffee',
      label: 'SimpleCoffee',
      role: 'Concrete Component',
      kind: 'class',
      x: 150,
      y: 260,
      description: 'The base object being decorated: a plain $2.00 coffee with no add-ons.',
    },
    {
      id: 'coffeeDecorator',
      label: 'CoffeeDecorator',
      role: 'Base Decorator',
      kind: 'abstract',
      x: 450,
      y: 380,
      width: 170,
      description: 'Abstract base that implements Coffee and stores the wrapped Coffee instance. MilkDecorator and SugarDecorator both extend it.',
    },
  ],
  relations: [
    {
      id: 'call',
      from: 'client',
      to: 'sugarDecorator',
      type: 'calls',
      label: 'cost()',
      description: 'The client only ever calls cost() on the outermost layer — it has no idea how many layers are underneath.',
      code: 'usage',
    },
    {
      id: 'wrapsMilk',
      from: 'sugarDecorator',
      to: 'milkDecorator',
      type: 'wraps',
      label: 'wraps',
      description: 'SugarDecorator was constructed around the MilkDecorator instance.',
      code: 'sugarDecorator',
    },
    {
      id: 'wrapsCoffee',
      from: 'milkDecorator',
      to: 'simpleCoffee',
      type: 'wraps',
      label: 'wraps',
      description: 'MilkDecorator was constructed around the SimpleCoffee instance.',
      code: 'milkDecorator',
    },
    {
      id: 'sugarExtends',
      from: 'sugarDecorator',
      to: 'coffeeDecorator',
      type: 'implements',
      description: 'SugarDecorator extends CoffeeDecorator, inheriting the delegation logic.',
      bend: 30,
      code: 'sugarDecorator',
    },
    {
      id: 'milkExtends',
      from: 'milkDecorator',
      to: 'coffeeDecorator',
      type: 'implements',
      description: 'MilkDecorator extends CoffeeDecorator, inheriting the delegation logic.',
      bend: -30,
      code: 'milkDecorator',
    },
    {
      id: 'wrappee',
      from: 'coffeeDecorator',
      to: 'coffee',
      type: 'holds',
      label: 'wrappee: Coffee',
      description: 'CoffeeDecorator stores its wrapped object typed only as Coffee — the same interface it implements — so any decorator can wrap any Coffee, including another decorator.',
      bend: 40,
      code: 'coffeeDecorator',
    },
    {
      id: 'decoratorImpl',
      from: 'coffeeDecorator',
      to: 'coffee',
      type: 'implements',
      description: 'CoffeeDecorator implements Coffee, so any stack of decorators can stand in for a plain Coffee.',
      code: 'coffeeDecorator',
    },
    {
      id: 'simpleImpl',
      from: 'simpleCoffee',
      to: 'coffee',
      type: 'implements',
      description: 'SimpleCoffee implements Coffee directly.',
      code: 'simpleCoffee',
    },
  ],
  steps: [
    {
      title: 'Build the stack',
      description: 'A SimpleCoffee is wrapped in a MilkDecorator, which is then wrapped in a SugarDecorator. Each layer only knows about the one directly inside it.',
      highlight: ['simpleCoffee', 'wrapsCoffee', 'milkDecorator', 'wrapsMilk', 'sugarDecorator'],
      notes: { simpleCoffee: '$2.00' },
      code: 'usage',
    },
    {
      title: 'Client calls cost()',
      description: 'The client calls cost() once, on the outermost decorator — SugarDecorator.',
      highlight: ['client', 'call', 'sugarDecorator'],
      packets: [{ relation: 'call', label: 'cost()' }],
      code: 'sugarDecorator',
    },
    {
      title: 'Call travels inward',
      description: 'SugarDecorator delegates to MilkDecorator before adding its own cost, which delegates to SimpleCoffee in turn.',
      highlight: ['sugarDecorator', 'wrapsMilk', 'milkDecorator', 'wrapsCoffee', 'simpleCoffee'],
      packets: [
        { relation: 'wrapsMilk', label: 'cost()' },
        { relation: 'wrapsCoffee', label: 'cost()' },
      ],
      code: 'milkDecorator',
    },
    {
      title: 'Base price returns',
      description: 'SimpleCoffee has no one left to delegate to — it just returns its own flat $2.00.',
      highlight: ['simpleCoffee', 'wrapsCoffee', 'milkDecorator'],
      packets: [{ relation: 'wrapsCoffee', label: '$2.00', reverse: true }],
      notes: { simpleCoffee: '$2.00' },
      code: 'simpleCoffee',
    },
    {
      title: 'Price accumulates on the way out',
      description: 'Each decorator adds its own cost to the value it gets back, so the price builds up as the result unwinds back to the client.',
      highlight: ['milkDecorator', 'wrapsMilk', 'sugarDecorator', 'call', 'client'],
      packets: [
        { relation: 'wrapsMilk', label: '$2.50', reverse: true },
        { relation: 'call', label: '$2.75', reverse: true },
      ],
      notes: { milkDecorator: '+$0.50', sugarDecorator: '+$0.25' },
      code: 'sugarDecorator',
    },
  ],
  code: `
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
    return \`\${super.description()} + milk\`
  }
}
// [/milkDecorator]

// [sugarDecorator]
class SugarDecorator extends CoffeeDecorator {
  cost() {
    return super.cost() + 0.25
  }
  description() {
    return \`\${super.description()} + sugar\`
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
`,
  csharp: `
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
`,
  Visualization: DecoratorVisualization,
}
