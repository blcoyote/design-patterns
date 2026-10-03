from typing import Protocol


# Plain class (not a dataclass): we deliberately want identity-based equality
# (the Python default), matching the TS example's reliance on object
# reference (===) for tracking entities in the pending lists below.
class Entity:
    def __init__(self, id: str) -> None:
        self.id = id


class Database(Protocol):
    def begin_transaction(self) -> None: ...
    def insert(self, entity: Entity) -> None: ...
    def update(self, entity: Entity) -> None: ...
    def delete(self, entity: Entity) -> None: ...
    def commit_transaction(self) -> None: ...
    def rollback_transaction(self) -> None: ...


# [database]
class SqlDatabase:
    def begin_transaction(self) -> None:
        print("BEGIN")

    def insert(self, entity: Entity) -> None:
        print(f"INSERT {entity.id}")

    def update(self, entity: Entity) -> None:
        print(f"UPDATE {entity.id}")

    def delete(self, entity: Entity) -> None:
        print(f"DELETE {entity.id}")

    def commit_transaction(self) -> None:
        print("COMMIT")

    def rollback_transaction(self) -> None:
        print("ROLLBACK")
# [/database]


# [unitOfWork]
class UnitOfWork:
    def __init__(self, db: Database) -> None:
        # [pendingNew]
        self._new_objects: list[Entity] = []
        # [/pendingNew]
        # [pendingDirty]
        self._dirty_objects: list[Entity] = []
        # [/pendingDirty]
        # [pendingRemoved]
        self._removed_objects: list[Entity] = []
        # [/pendingRemoved]
        self._db = db

    # [register]
    # Note: entities are tracked by reference (`in` falls back to identity
    # since Entity has no __eq__), so the very same object instance must be
    # passed to every register*() call for an entity. Real Unit of Work
    # implementations pair this with an Identity Map so a given row only
    # ever has one in-memory instance to begin with.

    # [registerNew]
    def register_new(self, entity: Entity) -> None:
        # Guards against double-registering the same still-unsaved entity as new.
        if entity not in self._new_objects:
            self._new_objects.append(entity)
    # [/registerNew]

    # [registerDirty]
    def register_dirty(self, entity: Entity) -> None:
        # Skips entities already queued as new (nothing to UPDATE yet) or already
        # marked dirty (no point queuing the same UPDATE twice).
        already_tracked = entity in self._new_objects or entity in self._dirty_objects
        if not already_tracked:
            self._dirty_objects.append(entity)
    # [/registerDirty]

    # [registerRemoved]
    def register_removed(self, entity: Entity) -> None:
        was_new = entity in self._new_objects
        # Whatever it was before, there is nothing left to insert or update.
        self._new_objects = [e for e in self._new_objects if e is not entity]
        self._dirty_objects = [e for e in self._dirty_objects if e is not entity]
        # A row that was never inserted has nothing to delete.
        if not was_new and entity not in self._removed_objects:
            self._removed_objects.append(entity)
    # [/registerRemoved]
    # [/register]

    # [commit]
    def commit(self) -> None:
        self._db.begin_transaction()
        try:
            # One statement per entity, in order: this example trades round trips
            # for simplicity. The atomicity guarantee comes from the single
            # transaction wrapping all of them, not from how many statements it took
            # to get there — a real ORM can batch these into fewer round trips.
            for entity in self._new_objects:
                self._db.insert(entity)
            for entity in self._dirty_objects:
                self._db.update(entity)
            for entity in self._removed_objects:
                self._db.delete(entity)
            self._db.commit_transaction()
            self._new_objects = []
            self._dirty_objects = []
            self._removed_objects = []
        except Exception:
            self._db.rollback_transaction()  # none of the writes above take effect
            raise
    # [/commit]
# [/unitOfWork]


# [client]
db = SqlDatabase()
uow = UnitOfWork(db)

order = Entity("order-104")
customer = Entity("customer-58")
cart = Entity("cart-9")

uow.register_new(order)
uow.register_dirty(customer)
uow.register_removed(cart)
uow.register_dirty(customer)  # already tracked — ignored

uow.commit()
# BEGIN
# INSERT order-104
# UPDATE customer-58
# DELETE cart-9
# COMMIT
# [/client]
