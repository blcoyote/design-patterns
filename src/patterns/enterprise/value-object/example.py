import re
from dataclasses import dataclass


# [money]
# A value object: it has no identity, only its amount and currency. frozen=True
# makes it immutable after creation, so it is safe to share and to use as a dict key.
# The amount is a whole number of cents, so there is no floating-point rounding.
@dataclass(frozen=True, eq=False)
class Money:
    amount: int
    currency: str

    # [moneyCreate]
    # Python cannot hide the constructor, so the check lives here and runs on
    # every construction: an invalid Money can never exist.
    def __post_init__(self) -> None:
        if self.amount < 0:
            raise ValueError('amount must be a non-negative whole number of cents')
        if re.fullmatch(r'[A-Z]{3}', self.currency) is None:
            raise ValueError(f'invalid currency {self.currency}')
    # [/moneyCreate]

    # [moneyAdd]
    # Returns a new Money. Neither operand changes.
    def add(self, other: 'Money') -> 'Money':
        if other.currency != self.currency:
            raise ValueError(f'cannot add {other.currency} to {self.currency}')
        return Money(self.amount + other.amount, self.currency)
    # [/moneyAdd]

    # [moneyEquals]
    # Equal by value: the same amount and currency are equal, whichever instance
    # holds them. Equal objects must hash equally, so __hash__ matches __eq__.
    def __eq__(self, other: object) -> bool:
        return isinstance(other, Money) and self.amount == other.amount and self.currency == other.currency

    def __hash__(self) -> int:
        return hash((self.amount, self.currency))
    # [/moneyEquals]

    def __str__(self) -> str:
        return f'{self.amount // 100}.{self.amount % 100:02d} {self.currency}'
# [/money]


# [orderId]
# A strongly typed id. OrderId and CustomerId are different classes, so a type
# checker such as mypy rejects one where the other is expected (Python itself
# does not check). Frozen dataclasses compare by value.
@dataclass(frozen=True)
class OrderId:
    value: str

    def __post_init__(self) -> None:
        if self.value == '':
            raise ValueError('order id must not be empty')

    def __str__(self) -> str:
        return self.value
# [/orderId]


# [customerId]
@dataclass(frozen=True)
class CustomerId:
    value: str

    def __post_init__(self) -> None:
        if self.value == '':
            raise ValueError('customer id must not be empty')

    def __str__(self) -> str:
        return self.value
# [/customerId]


# [order]
# An entity: identified by its id, not by its attributes. Its total is a value object.
class Order:
    def __init__(self, id: OrderId, customer: CustomerId, total: Money) -> None:
        self.id = id
        self.customer = customer
        self.total = total
# [/order]


# [client]
price = Money(1000, 'EUR')
shipping = Money(250, 'EUR')
total = price.add(shipping)
print(f'price {price}, total {total}')
# price 10.00 EUR, total 12.50 EUR
print(f"equal by value: {str(total == Money(1250, 'EUR')).lower()}")
# equal by value: true

try:
    Money(-5, 'EUR')
except ValueError as e:
    print(f'rejected: {e}')
# rejected: amount must be a non-negative whole number of cents
try:
    price.add(Money(100, 'USD'))
except ValueError as e:
    print(f'rejected: {e}')
# rejected: cannot add USD to EUR

order_id = OrderId('o-1')
customer_id = CustomerId('c-1')
order = Order(order_id, customer_id, total)
print(f'order {order.id} for {order.customer}, total {order.total}')
# order o-1 for c-1, total 12.50 EUR
# Order(customer_id, order_id, total)  # mypy error: CustomerId is not an OrderId
print(f"same id: {str(order.id == OrderId('o-1')).lower()}")
# same id: true
# [/client]
