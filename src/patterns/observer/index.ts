import type { PatternDefinition } from '@/types/pattern'

export const pattern: PatternDefinition = {
  slug: 'observer',
  name: 'Observer',
  category: 'behavioral',
  order: 1,
  summary: 'Let many objects subscribe to, and react to, changes in another object.',
  intent:
    'Define a one-to-many dependency so that when one object changes state, all its dependents are notified and updated automatically.',
  problem:
    'Several parts of an application need to react when some data changes — a chart, a table and a badge all show the same stock price. Polling wastes work, and hard-wiring the data source to each view couples it to every consumer.',
  solution:
    'The Subject keeps a list of Observers behind a tiny interface (update). Observers subscribe and unsubscribe themselves at runtime. When the Subject changes it loops over the list and calls update on each one — it never needs to know their concrete types.',
  analogy:
    'A newsletter: readers subscribe once, and every new issue is delivered to all current subscribers. The publisher does not care who the readers are, and anyone can unsubscribe at any time.',
  whenToUse: [
    'A change in one object requires changing others, and you do not know how many in advance.',
    'Consumers should be able to subscribe and unsubscribe dynamically.',
    'You want the source of data to stay decoupled from its presentations.',
  ],
  pros: [
    'Open/Closed: add new observers without touching the subject.',
    'Loose coupling — the subject only knows the Observer interface.',
    'Relationships can be established at runtime.',
  ],
  cons: [
    'Clients shouldn\'t rely on notification order.',
    'Forgotten subscriptions cause memory leaks (the "lapsed listener" problem).',
    'Cascading updates can be hard to trace and debug.',
  ],
  realWorld: [
    'DOM events: element.addEventListener("click", handler)',
    'RxJS Observables and Subjects',
    'React state libraries (Redux store.subscribe, Zustand, MobX)',
    'Node.js EventEmitter',
  ],
  related: ['pub-sub', 'mediator', 'command', 'strategy'],
  participants: [
    {
      id: 'observer',
      label: 'Observer',
      role: 'Observer interface',
      kind: 'interface',
      x: 400,
      y: 70,
      description: 'Declares the single update(price) method every subscriber must implement. The subject depends only on this.',
    },
    {
      id: 'subject',
      label: 'StockTicker',
      role: 'Subject',
      kind: 'class',
      x: 150,
      y: 250,
      width: 170,
      description:
        'Owns the interesting state (the price) and a list of observers. Offers subscribe/unsubscribe and calls notify() whenever the state changes.',
    },
    {
      id: 'chart',
      label: 'PriceChart',
      role: 'Concrete Observer',
      kind: 'class',
      x: 620,
      y: 180,
      description: 'Redraws a chart line whenever it receives a new price.',
    },
    {
      id: 'alert',
      label: 'PriceAlert',
      role: 'Concrete Observer',
      kind: 'class',
      x: 620,
      y: 300,
      description: 'Shows a warning when the price crosses a threshold.',
    },
    {
      id: 'logger',
      label: 'AuditLog',
      role: 'Concrete Observer',
      kind: 'class',
      x: 620,
      y: 410,
      description: 'Appends every price change to an audit trail.',
    },
  ],
  relations: [
    {
      id: 'holds',
      from: 'subject',
      to: 'observer',
      type: 'holds',
      label: 'observers[]',
      description: 'The subject stores a list typed as Observer — not as concrete classes. This is what keeps it decoupled.',
      code: 'subscribe',
    },
    { id: 'chart-impl', from: 'chart', to: 'observer', type: 'implements', description: 'PriceChart implements the Observer interface.' },
    { id: 'alert-impl', from: 'alert', to: 'observer', type: 'implements', description: 'PriceAlert implements the Observer interface.' },
    { id: 'logger-impl', from: 'logger', to: 'observer', type: 'implements', description: 'AuditLog implements the Observer interface.', bend: 40 },
    { id: 'notify-chart', from: 'subject', to: 'chart', type: 'notifies', label: 'update()', description: 'notify() calls update(price) on PriceChart.', code: 'notify' },
    { id: 'notify-alert', from: 'subject', to: 'alert', type: 'notifies', label: 'update()', description: 'notify() calls update(price) on PriceAlert.', code: 'notify' },
    { id: 'notify-logger', from: 'subject', to: 'logger', type: 'notifies', label: 'update()', description: 'notify() calls update(price) on AuditLog.', code: 'notify' },
  ],
  steps: [
    {
      title: 'Observers subscribe',
      description: 'The client subscribes each observer with the ticker. The ticker just stores them in a list of Observer.',
      highlight: ['subject', 'holds', 'chart', 'alert', 'logger'],
      notes: { subject: 'observers: 3' },
      code: 'subscribe',
    },
    {
      title: 'State changes',
      description: 'Someone sets a new price on the ticker. The ticker updates its internal state and calls notify().',
      highlight: ['subject'],
      notes: { subject: 'price = 101.5' },
      code: 'setPrice',
    },
    {
      title: 'Broadcast',
      description: 'notify() loops over the list and calls update(price) on every observer — without knowing their concrete types.',
      highlight: ['subject', 'notify-chart', 'notify-alert', 'notify-logger'],
      packets: [
        { relation: 'notify-chart', label: '101.5' },
        { relation: 'notify-alert', label: '101.5' },
        { relation: 'notify-logger', label: '101.5' },
      ],
      code: 'notify',
    },
    {
      title: 'Observers react',
      description: 'Each observer does its own thing with the new value: redraw, alert, log.',
      highlight: ['chart', 'alert', 'logger'],
      notes: { chart: 'redrawn', alert: '⚠ > 100', logger: '+1 entry' },
      code: 'concrete',
    },
    {
      title: 'Unsubscribe',
      description: 'The alert unsubscribes. Future changes only reach the chart and the log.',
      highlight: ['subject', 'alert'],
      notes: { subject: 'observers: 2', alert: 'unsubscribed' },
      code: 'unsubscribe',
    },
  ],
  code: `
// [observer]
interface Observer {
  update(price: number): void
}
// [/observer]

// [subject]
class StockTicker {
  private observers: Observer[] = []
  private price = 0

  // [subscribe]
  subscribe(o: Observer) {
    this.observers.push(o)
  }
  // [/subscribe]

  // [unsubscribe]
  unsubscribe(o: Observer) {
    this.observers = this.observers.filter((x) => x !== o)
  }
  // [/unsubscribe]

  // [setPrice]
  setPrice(price: number) {
    this.price = price
    this.notify()
  }
  // [/setPrice]

  // [notify]
  private notify() {
    // observers is reassigned (not mutated in place) by unsubscribe, so an
    // observer that unsubscribes itself mid-notify doesn't affect the
    // array we're already looping over here.
    for (const o of this.observers) o.update(this.price)
  }
  // [/notify]
}
// [/subject]

// [concrete]
// [chart]
class PriceChart implements Observer {
  update(price: number) {
    console.log(\`chart: plot \${price}\`)
  }
}
// [/chart]

// [alert]
class PriceAlert implements Observer {
  constructor(private limit: number) {}
  update(price: number) {
    if (price > this.limit) console.warn(\`price above \${this.limit}!\`)
  }
}
// [/alert]

// [logger]
class AuditLog implements Observer {
  entries: number[] = []
  update(price: number) {
    this.entries.push(price)
  }
}
// [/logger]
// [/concrete]

// Usage
const ticker = new StockTicker()
const alert = new PriceAlert(100)
ticker.subscribe(new PriceChart())
ticker.subscribe(alert)
ticker.subscribe(new AuditLog())

ticker.setPrice(101.5) // all three react
ticker.unsubscribe(alert)
ticker.setPrice(99) // only chart + log
`,
  csharp: `
// In production C# you'd often reach for the built-in event/EventHandler<T>
// or IObservable<T>/IObserver<T> instead of hand-rolling this, but we keep
// the explicit pattern structure here for clarity.

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
var ticker = new StockTicker();
var alert = new PriceAlert(100);
ticker.Subscribe(new PriceChart());
ticker.Subscribe(alert);
ticker.Subscribe(new AuditLog());

ticker.SetPrice(101.5m); // all three react
ticker.Unsubscribe(alert);
ticker.SetPrice(99m); // only chart + log

// [observer]
interface IObserver
{
    void Update(decimal price);
}
// [/observer]

// [subject]
class StockTicker
{
    private readonly List<IObserver> _observers = new();
    private decimal _price;

    // [subscribe]
    public void Subscribe(IObserver observer)
    {
        _observers.Add(observer);
    }
    // [/subscribe]

    // [unsubscribe]
    public void Unsubscribe(IObserver observer)
    {
        _observers.Remove(observer);
    }
    // [/unsubscribe]

    // [setPrice]
    public void SetPrice(decimal price)
    {
        _price = price;
        Notify();
    }
    // [/setPrice]

    // [notify]
    private void Notify()
    {
        // ToArray() snapshots the list so an observer that unsubscribes
        // itself during notification doesn't mutate the collection we're
        // iterating over.
        foreach (var observer in _observers.ToArray()) observer.Update(_price);
    }
    // [/notify]
}
// [/subject]

// [concrete]
// [chart]
class PriceChart : IObserver
{
    public void Update(decimal price)
    {
        Console.WriteLine($"chart: plot {price}");
    }
}
// [/chart]

// [alert]
class PriceAlert(decimal limit) : IObserver
{
    public void Update(decimal price)
    {
        if (price > limit) Console.WriteLine($"warning: price above {limit}!");
    }
}
// [/alert]

// [logger]
class AuditLog : IObserver
{
    public List<decimal> Entries { get; } = new();

    public void Update(decimal price)
    {
        Entries.Add(price);
    }
}
// [/logger]
// [/concrete]
`,
}
