from __future__ import annotations

from collections import deque
from dataclasses import dataclass, replace


# [records]
# The two shapes of data that move through the system. Both are immutable: a change never
# edits a record, it makes a new one, so a record already handed to another unit or queued
# for the pump can never change underneath its holder.


@dataclass(frozen=True)
class ShowRecord:
    """What a processing unit and the database each hold about one show."""

    show_id: str
    capacity: int
    seats_left: int


@dataclass(frozen=True)
class SeatWrite:
    """One change on its way to the database: the new seats_left of a show, and who caused it."""

    show_id: str
    seats_left: int
    buyer: str
# [/records]


# [database]
class Database:
    """
    The slow, durable store. It is the system of record, but no purchase ever touches it: the
    data reader loads from it on a cold start, and the data writer writes to it when it drains
    the pump.
    A dict iterates in insertion order, and applying a write keeps the show's place.
    """

    def __init__(self) -> None:
        self._shows: dict[str, ShowRecord] = {
            "show-1": ShowRecord(show_id="show-1", capacity=3, seats_left=3),
        }

    def get(self, show_id: str) -> ShowRecord | None:
        return self._shows.get(show_id)

    def all(self) -> list[ShowRecord]:
        """Every show, in insertion order."""
        return list(self._shows.values())

    def apply(self, write: SeatWrite) -> None:
        """Stores the write's seats_left as a new record for that show."""
        show = self._shows.get(write.show_id)
        # A write for a show the database does not have is a programmer bug.
        if show is None:
            raise LookupError(f"unknown show {write.show_id}")
        # Re-assigning an existing key keeps its position in the dict.
        self._shows[write.show_id] = replace(show, seats_left=write.seats_left)
# [/database]


# [dataPump]
class DataPump:
    """
    The data pump: a first in first out queue of changes waiting for the database. The grid
    sends to it; only the data writer takes from it.
    """

    def __init__(self) -> None:
        self._queue: deque[SeatWrite] = deque()

    def send(self, write: SeatWrite) -> None:
        self._queue.append(write)

    def size(self) -> int:
        return len(self._queue)

    def take(self) -> SeatWrite | None:
        """Removes and returns the oldest write, or None when the pump is empty."""
        if not self._queue:
            return None
        return self._queue.popleft()


class DataWriter:
    """
    The data writer: the only code that writes to the database. It runs only when drain is
    called; nothing here decides when. Real products flush on a delay or a batch size and may
    coalesce writes to the same key; this one applies every write, one by one, in the order
    they were sent.
    """

    @staticmethod
    def drain(pump: DataPump, db: Database) -> None:
        applied = 0
        write = pump.take()
        while write is not None:
            db.apply(write)
            applied += 1
            write = pump.take()
        show = db.get("show-1")
        if show is None:
            raise LookupError("unknown show show-1")
        print(f"[writer] applied {applied} writes; database: {show.show_id} seats left: {show.seats_left}")
# [/dataPump]


# [dataReader]
class DataReader:
    """
    The data reader: the only code that reads the database on behalf of a processing unit. It
    is used for a cold start, when the grid has no members and so no peer to copy from.
    """

    @staticmethod
    def load(unit: ProcessingUnit, db: Database) -> None:
        for show in db.all():
            unit.put(show)
            print(f"[reader] {unit.name} loaded {show.show_id} from the database (seats left: {show.seats_left})")
# [/dataReader]


# [dataGrid]
class DataGrid:
    """
    The data grid: it knows the processing units, in the order they joined, and keeps their
    replicas in step. Every change a unit makes is copied to the other units and forwarded to
    the data pump; that forwarding is the write-behind. Real data grids (Hazelcast, Apache
    Ignite, GigaSpaces) differ in the details; this simulation only shows the idea.

    This simulation copies a change to every other unit immediately, and runs one request at
    a time. Real grids usually replicate asynchronously, so for a moment two units can hold
    different values and both sell the last seat: a data collision. This simulation cannot show that.
    """

    def __init__(self, pump: DataPump) -> None:
        self._pump = pump
        self._units: list[ProcessingUnit] = []

    def has_members(self) -> bool:
        return len(self._units) > 0

    def members(self) -> list[ProcessingUnit]:
        """A copy of the member list, in join order."""
        return list(self._units)

    def join(self, unit: ProcessingUnit) -> None:
        """A new unit copies every record from the first member, if there is one, then becomes a member."""
        peer = self._units[0] if self._units else None
        if peer is not None:
            for record in peer.records():
                unit.put(record)
                print(f"[grid] {unit.name} copied {record.show_id} from {peer.name} (seats left: {record.seats_left})")
        self._units.append(unit)

    def replicate(self, source: ProcessingUnit, record: ShowRecord, buyer: str) -> None:
        """Puts the record into every member except the source, then forwards the change to the pump."""
        # Iterate a snapshot of the members, in join order.
        for member in self.members():
            if member is not source:
                member.put(record)
        self._pump.send(SeatWrite(show_id=record.show_id, seats_left=record.seats_left, buyer=buyer))
# [/dataGrid]


# [processingUnit]
class ProcessingUnit:
    """
    A processing unit: it answers requests from its own in-memory replica of the data and
    never touches the database. Its replica is private; other units reach it only through the
    grid.
    """

    def __init__(self, name: str, grid: DataGrid) -> None:
        self.name = name
        self._grid = grid
        # Insertion order, like the database.
        self._replica: dict[str, ShowRecord] = {}

    def put(self, record: ShowRecord) -> None:
        self._replica[record.show_id] = record

    def get(self, show_id: str) -> ShowRecord | None:
        return self._replica.get(show_id)

    def records(self) -> list[ShowRecord]:
        """Every record in the replica, in insertion order."""
        return list(self._replica.values())

    def buy(self, buyer: str, show_id: str) -> bool:
        """Sells one seat from the local replica. Returns False when the show is sold out."""
        show = self._replica.get(show_id)
        # A show the unit does not hold is a programmer bug, not a sold-out answer.
        if show is None:
            raise LookupError(f"{self.name} has no {show_id}")
        if show.seats_left == 0:
            print(f"[{self.name}] {buyer} rejected: {show_id} is sold out")
            return False
        seat = show.capacity - show.seats_left + 1
        updated = replace(show, seats_left=show.seats_left - 1)
        # Re-assigning an existing key keeps its position in the dict.
        self._replica[show_id] = updated
        self._grid.replicate(self, updated, buyer)
        print(f"[{self.name}] {buyer} gets seat {seat} (seats left: {updated.seats_left})")
        return True
# [/processingUnit]


# [messagingGrid]
class MessagingGrid:
    """
    The messaging grid: it takes a request and hands it to one processing unit. Here the
    choice is round robin over the members at that moment: a counter, taken modulo the member
    count, then incremented. Real messaging grids can also route by load or by the data a
    request needs.
    """

    def __init__(self, grid: DataGrid) -> None:
        self._grid = grid
        self._counter = 0

    def buy(self, buyer: str, show_id: str) -> bool:
        # Route over a snapshot of the members, in join order.
        members = self._grid.members()
        if not members:
            raise RuntimeError("no processing unit is running")
        unit = members[self._counter % len(members)]
        self._counter += 1
        return unit.buy(buyer, show_id)
# [/messagingGrid]


# [deploymentManager]
class DeploymentManager:
    """
    The deployment manager: it starts processing units when load calls for them. The first
    unit finds an empty grid and is filled from the database by the data reader; every later
    one copies from a peer through the grid. Real deployment managers can also watch load
    and stop units; here the caller decides when to start one.
    """

    def __init__(self, grid: DataGrid, db: Database) -> None:
        self._grid = grid
        self._db = db

    def start(self, name: str) -> ProcessingUnit:
        print(f"[deploy] starting {name}")
        unit = ProcessingUnit(name, self._grid)
        # Cold start: nobody to copy from, so read the database.
        if not self._grid.has_members():
            DataReader.load(unit, self._db)
        # For the first unit join copies nothing; for a later one it copies from a peer.
        self._grid.join(unit)
        return unit
# [/deploymentManager]


# [usage]
db = Database()
pump = DataPump()
grid = DataGrid(pump)
messaging = MessagingGrid(grid)
deployment = DeploymentManager(grid, db)

deployment.start("pu-1")
deployment.start("pu-2")

# Two purchases, answered by pu-1 and pu-2 in turn. Neither reaches the database.
messaging.buy("alice", "show-1")
messaging.buy("bob", "show-1")
stored = db.get("show-1")
if stored is None:
    raise LookupError("unknown show show-1")
print(f"database: show-1 seats left: {stored.seats_left}, pump holds {pump.size()} writes")

# The spike: a third unit starts and copies the current state from pu-1.
deployment.start("pu-3")
messaging.buy("carol", "show-1")
messaging.buy("dave", "show-1")

# The writer drains the pump: only now does the database catch up.
DataWriter.drain(pump, db)
# [/usage]
