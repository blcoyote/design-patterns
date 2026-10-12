package main

import "fmt"

// [records]
// The two shapes of data that move through the system. Both are plain structs passed by value:
// a change never edits a record, it makes a new one, so a record already handed to another unit
// or queued for the pump can never change underneath its holder.

// ShowRecord is what a processing unit and the database each hold about one show.
type ShowRecord struct {
	ShowID    string
	Capacity  int
	SeatsLeft int
}

// SeatWrite is one change on its way to the database: the new SeatsLeft of a show, and who
// caused it.
type SeatWrite struct {
	ShowID    string
	SeatsLeft int
	Buyer     string
}

// [/records]

// [database]
// Database is the slow, durable store. It is the system of record, but no purchase ever touches
// it: the data reader loads from it on a cold start, and the data writer writes to it when it
// drains the pump.
// A Go map has no defined iteration order, so the ids are kept in a slice next to it: they keep
// insertion order, and applying a write keeps the show's place.
type Database struct {
	ids   []string
	shows map[string]ShowRecord
}

func NewDatabase() *Database {
	return &Database{
		ids:   []string{"show-1"},
		shows: map[string]ShowRecord{"show-1": {ShowID: "show-1", Capacity: 3, SeatsLeft: 3}},
	}
}

func (d *Database) Get(showID string) (ShowRecord, bool) {
	show, ok := d.shows[showID]
	return show, ok
}

// All returns every show, in insertion order.
func (d *Database) All() []ShowRecord {
	shows := make([]ShowRecord, 0, len(d.ids))
	for _, id := range d.ids {
		shows = append(shows, d.shows[id])
	}
	return shows
}

// Apply stores the write's SeatsLeft as a new record for that show.
func (d *Database) Apply(write SeatWrite) error {
	show, ok := d.shows[write.ShowID]
	// A write for a show the database does not have is a programmer bug, so it is a returned error.
	if !ok {
		return fmt.Errorf("unknown show %s", write.ShowID)
	}
	show.SeatsLeft = write.SeatsLeft
	d.shows[write.ShowID] = show
	return nil
}

// [/database]

// [dataPump]
// DataPump is a first in first out queue of changes waiting for the database. The grid sends to
// it; only the data writer takes from it.
type DataPump struct {
	queue []SeatWrite
}

func (p *DataPump) Send(write SeatWrite) {
	p.queue = append(p.queue, write)
}

func (p *DataPump) Size() int {
	return len(p.queue)
}

// Take removes and returns the oldest write, or false when the pump is empty.
func (p *DataPump) Take() (SeatWrite, bool) {
	if len(p.queue) == 0 {
		return SeatWrite{}, false
	}
	write := p.queue[0]
	p.queue = p.queue[1:]
	return write, true
}

// DataWriter is the only code that writes to the database. It runs only when Drain is called;
// nothing here decides when. Real products flush on a delay or a batch size and may coalesce
// writes to the same key; this one applies every write, one by one, in the order they were sent.
// Go has no static methods, so the writer is an empty struct with a method (the TypeScript
// version uses a static method).
type DataWriter struct{}

func (DataWriter) Drain(pump *DataPump, db *Database) error {
	applied := 0
	for write, ok := pump.Take(); ok; write, ok = pump.Take() {
		if err := db.Apply(write); err != nil {
			return err
		}
		applied++
	}
	show, ok := db.Get("show-1")
	if !ok {
		return fmt.Errorf("unknown show show-1")
	}
	fmt.Printf("[writer] applied %d writes; database: %s seats left: %d\n", applied, show.ShowID, show.SeatsLeft)
	return nil
}

// [/dataPump]

// [dataReader]
// DataReader is the only code that reads the database on behalf of a processing unit. It is
// used for a cold start, when the grid has no members and so no peer to copy from. Like the
// writer it is an empty struct with a method, in place of a static method.
type DataReader struct{}

func (DataReader) Load(unit *ProcessingUnit, db *Database) {
	for _, show := range db.All() {
		unit.Put(show)
		fmt.Printf("[reader] %s loaded %s from the database (seats left: %d)\n", unit.Name, show.ShowID, show.SeatsLeft)
	}
}

// [/dataReader]

// [dataGrid]
// DataGrid knows the processing units, in the order they joined, and keeps their replicas in
// step. Every change a unit makes is copied to the other units and forwarded to the data pump;
// that forwarding is the write-behind. Real data grids (Hazelcast, Apache Ignite, GigaSpaces)
// differ in the details; this simulation only shows the idea.
//
// This simulation copies a change to every other unit immediately and runs one request at a
// time, so no two units ever act on the same seat at once. Real grids serve requests
// concurrently and often replicate asynchronously, so two units can both sell the last seat
// (a data collision) unless the grid locks or version-checks that entry. This simulation
// cannot show that.
type DataGrid struct {
	units []*ProcessingUnit
	pump  *DataPump
}

func NewDataGrid(pump *DataPump) *DataGrid {
	return &DataGrid{pump: pump}
}

func (g *DataGrid) HasMembers() bool {
	return len(g.units) > 0
}

// Members returns a copy of the member list, in join order.
func (g *DataGrid) Members() []*ProcessingUnit {
	return append([]*ProcessingUnit(nil), g.units...)
}

// Join makes a new unit copy every record from the first member, if there is one, then become a
// member.
func (g *DataGrid) Join(unit *ProcessingUnit) {
	if len(g.units) > 0 {
		peer := g.units[0]
		for _, record := range peer.Records() {
			unit.Put(record)
			fmt.Printf("[grid] %s copied %s from %s (seats left: %d)\n", unit.Name, record.ShowID, peer.Name, record.SeatsLeft)
		}
	}
	g.units = append(g.units, unit)
}

// Replicate puts the record into every member except the source, then forwards the change to the
// pump.
func (g *DataGrid) Replicate(source *ProcessingUnit, record ShowRecord, buyer string) {
	// Iterate a copy of the members, in join order.
	for _, member := range g.Members() {
		if member != source {
			member.Put(record)
		}
	}
	g.pump.Send(SeatWrite{ShowID: record.ShowID, SeatsLeft: record.SeatsLeft, Buyer: buyer})
}

// [/dataGrid]

// [processingUnit]
// ProcessingUnit answers requests from its own in-memory replica of the data and never touches
// the database. Its replica is private; other units reach it only through the grid.
type ProcessingUnit struct {
	Name string
	grid *DataGrid
	// The ids keep insertion order, like the database.
	ids     []string
	replica map[string]ShowRecord
}

func NewProcessingUnit(name string, grid *DataGrid) *ProcessingUnit {
	return &ProcessingUnit{Name: name, grid: grid, replica: map[string]ShowRecord{}}
}

// Put stores the record; an id already in the replica is replaced and keeps its place.
func (u *ProcessingUnit) Put(record ShowRecord) {
	if _, exists := u.replica[record.ShowID]; !exists {
		u.ids = append(u.ids, record.ShowID)
	}
	u.replica[record.ShowID] = record
}

func (u *ProcessingUnit) Get(showID string) (ShowRecord, bool) {
	record, ok := u.replica[showID]
	return record, ok
}

// Records returns every record in the replica, in insertion order.
func (u *ProcessingUnit) Records() []ShowRecord {
	records := make([]ShowRecord, 0, len(u.ids))
	for _, id := range u.ids {
		records = append(records, u.replica[id])
	}
	return records
}

// Buy sells one seat from the local replica. It returns false when the show is sold out.
func (u *ProcessingUnit) Buy(buyer string, showID string) (bool, error) {
	show, ok := u.replica[showID]
	// A show the unit does not hold is a programmer bug, not a sold-out answer.
	if !ok {
		return false, fmt.Errorf("%s has no %s", u.Name, showID)
	}
	if show.SeatsLeft == 0 {
		fmt.Printf("[%s] %s rejected: %s is sold out\n", u.Name, buyer, showID)
		return false, nil
	}
	seat := show.Capacity - show.SeatsLeft + 1
	updated := ShowRecord{ShowID: show.ShowID, Capacity: show.Capacity, SeatsLeft: show.SeatsLeft - 1}
	u.replica[showID] = updated
	u.grid.Replicate(u, updated, buyer)
	fmt.Printf("[%s] %s gets seat %d (seats left: %d)\n", u.Name, buyer, seat, updated.SeatsLeft)
	return true, nil
}

// [/processingUnit]

// [messagingGrid]
// MessagingGrid takes a request and hands it to one processing unit. Here the choice is round
// robin over the members at that moment: a counter, taken modulo the member count, then
// incremented. Real messaging grids can also route by load or by the data a request needs.
type MessagingGrid struct {
	grid    *DataGrid
	counter int
}

func NewMessagingGrid(grid *DataGrid) *MessagingGrid {
	return &MessagingGrid{grid: grid}
}

func (m *MessagingGrid) Buy(buyer string, showID string) (bool, error) {
	// Route over a copy of the members, in join order.
	members := m.grid.Members()
	if len(members) == 0 {
		return false, fmt.Errorf("no processing unit is running")
	}
	unit := members[m.counter%len(members)]
	m.counter++
	return unit.Buy(buyer, showID)
}

// [/messagingGrid]

// [deploymentManager]
// DeploymentManager starts processing units when load calls for them. The first unit finds an
// empty grid and is filled from the database by the data reader; every later one copies from a
// peer through the grid. Real deployment managers can also watch load and stop units; here the
// caller decides when to start one.
type DeploymentManager struct {
	grid *DataGrid
	db   *Database
}

func NewDeploymentManager(grid *DataGrid, db *Database) *DeploymentManager {
	return &DeploymentManager{grid: grid, db: db}
}

func (d *DeploymentManager) Start(name string) *ProcessingUnit {
	fmt.Printf("[deploy] starting %s\n", name)
	unit := NewProcessingUnit(name, d.grid)
	// Cold start: nobody to copy from, so read the database.
	if !d.grid.HasMembers() {
		DataReader{}.Load(unit, d.db)
	}
	// For the first unit Join copies nothing; for a later one it copies from a peer.
	d.grid.Join(unit)
	return unit
}

// [/deploymentManager]

// [usage]
// check stops the demo at once on an error: here that can only be a bug in the wiring below,
// not something the example could recover from.
func check(err error) {
	if err != nil {
		panic(err)
	}
}

func main() {
	db := NewDatabase()
	pump := &DataPump{}
	grid := NewDataGrid(pump)
	messaging := NewMessagingGrid(grid)
	deployment := NewDeploymentManager(grid, db)

	deployment.Start("pu-1")
	deployment.Start("pu-2")

	// Two purchases, answered by pu-1 and pu-2 in turn. Neither reaches the database.
	_, err := messaging.Buy("alice", "show-1")
	check(err)
	_, err = messaging.Buy("bob", "show-1")
	check(err)
	stored, ok := db.Get("show-1")
	if !ok {
		check(fmt.Errorf("unknown show show-1"))
	}
	fmt.Printf("database: show-1 seats left: %d, pump holds %d writes\n", stored.SeatsLeft, pump.Size())

	// The spike: a third unit starts and copies the current state from pu-1.
	deployment.Start("pu-3")
	_, err = messaging.Buy("carol", "show-1")
	check(err)
	_, err = messaging.Buy("dave", "show-1")
	check(err)

	// The writer drains the pump: only now does the database catch up.
	check(DataWriter{}.Drain(pump, db))
}

// [/usage]
