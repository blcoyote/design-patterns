// [money]
// A value object: it has no identity, only its amount and currency. It cannot
// change after creation, so it is safe to share.
class Money {
  // The amount is a whole number of cents, so there is no floating-point rounding.
  // The upper bound keeps every amount exact and keeps a sum of two amounts from overflowing.
  static readonly MAX_CENTS = 1_000_000_000_000_000;

  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  // [moneyCreate]
  // The only way in, so an invalid Money cannot be created.
  static of(amount: number, currency: string): Money {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > Money.MAX_CENTS) {
      throw new Error("amount must be a whole number of cents from 0 to 1000000000000000");
    }
    // Checks the shape only. A real system would check a list of ISO 4217 codes.
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`invalid currency ${currency}`);
    return new Money(amount, currency);
  }
  // [/moneyCreate]

  // [moneyAdd]
  // Returns a new Money. Neither operand changes. The sum goes back through
  // the factory, so it is checked like any other amount.
  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new Error(`cannot add ${other.currency} to ${this.currency}`);
    }
    return Money.of(this.amount + other.amount, this.currency);
  }
  // [/moneyAdd]

  // [moneyEquals]
  // Equal by value: the same amount and currency are equal, whichever instance holds them.
  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
  // [/moneyEquals]

  toString(): string {
    const cents = String(this.amount % 100).padStart(2, "0");
    return `${Math.floor(this.amount / 100)}.${cents} ${this.currency}`;
  }
}
// [/money]

// [orderId]
// A strongly typed id. The private field makes OrderId and CustomerId
// different types to the compiler even though both wrap a string.
class OrderId {
  private constructor(private readonly value: string) {}

  static of(value: string): OrderId {
    if (value === "") throw new Error("order id must not be empty");
    return new OrderId(value);
  }
  equals(other: OrderId): boolean {
    return this.value === other.value;
  }
  toString(): string {
    return this.value;
  }
}
// [/orderId]

// [customerId]
class CustomerId {
  private constructor(private readonly value: string) {}

  static of(value: string): CustomerId {
    if (value === "") throw new Error("customer id must not be empty");
    return new CustomerId(value);
  }
  equals(other: CustomerId): boolean {
    return this.value === other.value;
  }
  toString(): string {
    return this.value;
  }
}
// [/customerId]

// [order]
// An entity: identified by its id, not by its attributes. Its total is a value object.
class Order {
  constructor(
    readonly id: OrderId,
    readonly customer: CustomerId,
    readonly total: Money,
  ) {}
}
// [/order]

// [client]
const price = Money.of(1000, "EUR");
const shipping = Money.of(250, "EUR");
const total = price.add(shipping);
console.log(`price ${price}, total ${total}`);
// price 10.00 EUR, total 12.50 EUR
console.log(`equal by value: ${total.equals(Money.of(1250, "EUR"))}`);
// equal by value: true

try {
  Money.of(-5, "EUR");
} catch (e) {
  console.log(`rejected: ${e instanceof Error ? e.message : String(e)}`);
}
// rejected: amount must be a whole number of cents from 0 to 1000000000000000
try {
  price.add(Money.of(100, "USD"));
} catch (e) {
  console.log(`rejected: ${e instanceof Error ? e.message : String(e)}`);
}
// rejected: cannot add USD to EUR

const orderId = OrderId.of("o-1");
const customerId = CustomerId.of("c-1");
const order = new Order(orderId, customerId, total);
console.log(`order ${order.id} for ${order.customer}, total ${order.total}`);
// order o-1 for c-1, total 12.50 EUR
// [idSwap]
// new Order(customerId, orderId, total); // does not compile: CustomerId is not an OrderId
// [/idSwap]
console.log(`same id: ${order.id.equals(OrderId.of("o-1"))}`);
// same id: true
// [/client]
