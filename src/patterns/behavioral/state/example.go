package main

import "fmt"

// [documentState]
type DocumentState interface {
	Name() string
	Submit() DocumentState
	Approve() DocumentState
	Reject() DocumentState
	Revise() DocumentState
}

// [/documentState]

// [draft]
type DraftState struct{}

func (DraftState) Name() string { return "Draft" }

// [submit]
func (DraftState) Submit() DocumentState {
	fmt.Println("Draft submitted for review")
	return InReviewState{}
}

// [/submit]

func (s DraftState) Approve() DocumentState {
	return s // not a valid transition from Draft
}

func (s DraftState) Reject() DocumentState {
	return s
}

func (s DraftState) Revise() DocumentState {
	return s
}

// [/draft]

// [review]
type InReviewState struct{}

func (InReviewState) Name() string { return "InReview" }

func (s InReviewState) Submit() DocumentState {
	return s
}

// [approve]
func (InReviewState) Approve() DocumentState {
	fmt.Println("Review approved — publishing")
	return PublishedState{}
}

// [/approve]

// [reject]
func (InReviewState) Reject() DocumentState {
	fmt.Println("Review rejected — back for changes")
	return RejectedState{}
}

// [/reject]

func (s InReviewState) Revise() DocumentState {
	return s
}

// [/review]

// [published]
type PublishedState struct{}

func (PublishedState) Name() string { return "Published" }

// Published is terminal: every action is a no-op.
func (s PublishedState) Submit() DocumentState {
	return s
}

func (s PublishedState) Approve() DocumentState {
	return s
}

func (s PublishedState) Reject() DocumentState {
	return s
}

func (s PublishedState) Revise() DocumentState {
	return s
}

// [/published]

// [rejected]
type RejectedState struct{}

func (RejectedState) Name() string { return "Rejected" }

func (s RejectedState) Submit() DocumentState {
	return s
}

func (s RejectedState) Approve() DocumentState {
	return s
}

func (s RejectedState) Reject() DocumentState {
	return s
}

// [revise]
func (RejectedState) Revise() DocumentState {
	fmt.Println("Revised — back to Draft")
	return DraftState{}
}

// [/revise]
// [/rejected]

// [document]
type Document struct {
	// [holds]
	state DocumentState
	// [/holds]
}

func NewDocument() *Document {
	return &Document{state: DraftState{}}
}

func (d *Document) Status() string {
	return d.state.Name()
}

// [delegate]
func (d *Document) Submit() {
	d.state = d.state.Submit()
}

func (d *Document) Approve() {
	d.state = d.state.Approve()
}

func (d *Document) Reject() {
	d.state = d.state.Reject()
}

func (d *Document) Revise() {
	d.state = d.state.Revise()
}

// [/delegate]
// [/document]

// [client]
func main() {
	doc := NewDocument()
	fmt.Println(doc.Status()) // "Draft"

	doc.Submit()
	fmt.Println(doc.Status()) // "InReview"

	doc.Reject()
	fmt.Println(doc.Status()) // "Rejected"

	doc.Revise()
	fmt.Println(doc.Status()) // "Draft"

	doc.Submit()
	fmt.Println(doc.Status()) // "InReview"

	doc.Approve()
	fmt.Println(doc.Status()) // "Published"

	doc.Submit()              // ignored — Published is terminal
	fmt.Println(doc.Status()) // "Published"
}

// [/client]
