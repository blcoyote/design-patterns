// [records]
/**
 * The two shapes of data that move through the system. Both are immutable: a change never
 * edits a record, it makes a new one, so a record already handed to another unit or queued
 * for the pump can never change underneath its holder.
 */

/** What a processing unit and the database each hold about one show. */
interface ShowRecord {
  readonly showId: string;
  readonly capacity: number;
  readonly seatsLeft: number;
}

/** One change on its way to the database: the new seatsLeft of a show, and who caused it. */
interface SeatWrite {
  readonly showId: string;
  readonly seatsLeft: number;
  readonly buyer: string;
}
// [/records]

// [database]
/**
 * The slow, durable store. It is the system of record, but no purchase ever touches it: the
 * data reader loads from it on a cold start, and the data writer writes to it when it drains
 * the pump.
 * A Map iterates in insertion order, and applying a write keeps the show's place.
 */
class Database {
  private readonly shows = new Map<string, ShowRecord>([
    ["show-1", { showId: "show-1", capacity: 3, seatsLeft: 3 }],
  ]);

  get(showId: string): ShowRecord | undefined {
    return this.shows.get(showId);
  }

  /** Every show, in insertion order. */
  all(): ShowRecord[] {
    return [...this.shows.values()];
  }

  /** Stores the write's seatsLeft as a new record for that show. */
  apply(write: SeatWrite): void {
    const show = this.shows.get(write.showId);
    // A write for a show the database does not have is a programmer bug.
    if (show === undefined) throw new Error(`unknown show ${write.showId}`);
    this.shows.set(write.showId, { ...show, seatsLeft: write.seatsLeft });
  }
}
// [/database]

// [dataPump]
/**
 * The data pump: a first in first out queue of changes waiting for the database. The grid
 * sends to it; only the data writer takes from it.
 */
class DataPump {
  private readonly queue: SeatWrite[] = [];

  send(write: SeatWrite): void {
    this.queue.push(write);
  }

  size(): number {
    return this.queue.length;
  }

  /** Removes and returns the oldest write, or undefined when the pump is empty. */
  take(): SeatWrite | undefined {
    return this.queue.shift();
  }
}

/**
 * The data writer: the only code that writes to the database. It runs only when drain is
 * called; nothing here decides when. Real products flush on a delay or a batch size and may
 * coalesce writes to the same key; this one applies every write, one by one, in the order
 * they were sent.
 */
class DataWriter {
  static drain(pump: DataPump, db: Database): void {
    let applied = 0;
    for (let write = pump.take(); write !== undefined; write = pump.take()) {
      db.apply(write);
      applied++;
    }
    const show = db.get("show-1");
    if (show === undefined) throw new Error("unknown show show-1");
    console.log(
      `[writer] applied ${applied} writes; database: ${show.showId} seats left: ${show.seatsLeft}`,
    );
  }
}
// [/dataPump]

// [dataReader]
/**
 * The data reader: the only code that reads the database on behalf of a processing unit. It
 * is used for a cold start, when the grid has no members and so no peer to copy from.
 */
class DataReader {
  static load(unit: ProcessingUnit, db: Database): void {
    for (const show of db.all()) {
      unit.put(show);
      console.log(
        `[reader] ${unit.name} loaded ${show.showId} from the database (seats left: ${show.seatsLeft})`,
      );
    }
  }
}
// [/dataReader]

// [dataGrid]
/**
 * The data grid: it knows the processing units, in the order they joined, and keeps their
 * replicas in step. Every change a unit makes is copied to the other units and forwarded to
 * the data pump; that forwarding is the write-behind. Real data grids (Hazelcast, Apache
 * Ignite, GigaSpaces) differ in the details; this simulation only shows the idea.
 *
 * This simulation copies a change to every other unit immediately, and runs one request at
 * a time. Real grids usually replicate asynchronously, so for a moment two units can hold
 * different values and both sell the last seat: a data collision. This simulation cannot show that.
 */
class DataGrid {
  private readonly units: ProcessingUnit[] = [];

  constructor(private readonly pump: DataPump) {}

  hasMembers(): boolean {
    return this.units.length > 0;
  }

  /** A copy of the member list, in join order. */
  members(): ProcessingUnit[] {
    return [...this.units];
  }

  /** A new unit copies every record from the first member, if there is one, then becomes a member. */
  join(unit: ProcessingUnit): void {
    const peer = this.units[0];
    if (peer !== undefined) {
      for (const record of peer.records()) {
        unit.put(record);
        console.log(
          `[grid] ${unit.name} copied ${record.showId} from ${peer.name} (seats left: ${record.seatsLeft})`,
        );
      }
    }
    this.units.push(unit);
  }

  /** Puts the record into every member except the source, then forwards the change to the pump. */
  replicate(source: ProcessingUnit, record: ShowRecord, buyer: string): void {
    // Iterate a snapshot of the members, in join order.
    for (const member of this.members()) {
      if (member !== source) member.put(record);
    }
    this.pump.send({ showId: record.showId, seatsLeft: record.seatsLeft, buyer });
  }
}
// [/dataGrid]

// [processingUnit]
/**
 * A processing unit: it answers requests from its own in-memory replica of the data and
 * never touches the database. Its replica is private; other units reach it only through the
 * grid.
 */
class ProcessingUnit {
  // Insertion order, like the database.
  private readonly replica = new Map<string, ShowRecord>();

  constructor(
    readonly name: string,
    private readonly grid: DataGrid,
  ) {}

  put(record: ShowRecord): void {
    this.replica.set(record.showId, record);
  }

  get(showId: string): ShowRecord | undefined {
    return this.replica.get(showId);
  }

  /** Every record in the replica, in insertion order. */
  records(): ShowRecord[] {
    return [...this.replica.values()];
  }

  /** Sells one seat from the local replica. Returns false when the show is sold out. */
  buy(buyer: string, showId: string): boolean {
    const show = this.replica.get(showId);
    // A show the unit does not hold is a programmer bug, not a sold-out answer.
    if (show === undefined) throw new Error(`${this.name} has no ${showId}`);
    if (show.seatsLeft === 0) {
      console.log(`[${this.name}] ${buyer} rejected: ${showId} is sold out`);
      return false;
    }
    const seat = show.capacity - show.seatsLeft + 1;
    const updated: ShowRecord = { ...show, seatsLeft: show.seatsLeft - 1 };
    this.replica.set(showId, updated);
    this.grid.replicate(this, updated, buyer);
    console.log(`[${this.name}] ${buyer} gets seat ${seat} (seats left: ${updated.seatsLeft})`);
    return true;
  }
}
// [/processingUnit]

// [messagingGrid]
/**
 * The messaging grid: it takes a request and hands it to one processing unit. Here the
 * choice is round robin over the members at that moment: a counter, taken modulo the member
 * count, then incremented. Real messaging grids can also route by load or by the data a
 * request needs.
 */
class MessagingGrid {
  private counter = 0;

  constructor(private readonly grid: DataGrid) {}

  buy(buyer: string, showId: string): boolean {
    // Route over a snapshot of the members, in join order.
    const members = this.grid.members();
    const unit = members[this.counter % members.length];
    if (unit === undefined) throw new Error("no processing unit is running");
    this.counter++;
    return unit.buy(buyer, showId);
  }
}
// [/messagingGrid]

// [deploymentManager]
/**
 * The deployment manager: it starts processing units when load calls for them. The first
 * unit finds an empty grid and is filled from the database by the data reader; every later
 * one copies from a peer through the grid. Real deployment managers can also watch load
 * and stop units; here the caller decides when to start one.
 */
class DeploymentManager {
  constructor(
    private readonly grid: DataGrid,
    private readonly db: Database,
  ) {}

  start(name: string): ProcessingUnit {
    console.log(`[deploy] starting ${name}`);
    const unit = new ProcessingUnit(name, this.grid);
    // Cold start: nobody to copy from, so read the database.
    if (!this.grid.hasMembers()) DataReader.load(unit, this.db);
    // For the first unit join copies nothing; for a later one it copies from a peer.
    this.grid.join(unit);
    return unit;
  }
}
// [/deploymentManager]

// [usage]
const db = new Database();
const pump = new DataPump();
const grid = new DataGrid(pump);
const messaging = new MessagingGrid(grid);
const deployment = new DeploymentManager(grid, db);

deployment.start("pu-1");
deployment.start("pu-2");

// Two purchases, answered by pu-1 and pu-2 in turn. Neither reaches the database.
messaging.buy("alice", "show-1");
messaging.buy("bob", "show-1");
const stored = db.get("show-1");
if (stored === undefined) throw new Error("unknown show show-1");
console.log(`database: show-1 seats left: ${stored.seatsLeft}, pump holds ${pump.size()} writes`);

// The spike: a third unit starts and copies the current state from pu-1.
deployment.start("pu-3");
messaging.buy("carol", "show-1");
messaging.buy("dave", "show-1");

// The writer drains the pump: only now does the database catch up.
DataWriter.drain(pump, db);
// [/usage]
