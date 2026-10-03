// [documentState]
interface DocumentState {
  readonly name: string
  submit(): DocumentState
  approve(): DocumentState
  reject(): DocumentState
  revise(): DocumentState
}
// [/documentState]

// [draft]
class DraftState implements DocumentState {
  readonly name = 'Draft'

  // [submit]
  submit(): DocumentState {
    console.log('Draft submitted for review')
    return new InReviewState()
  }
  // [/submit]

  approve(): DocumentState {
    return this // not a valid transition from Draft
  }

  reject(): DocumentState {
    return this
  }

  revise(): DocumentState {
    return this
  }
}
// [/draft]

// [review]
class InReviewState implements DocumentState {
  readonly name = 'InReview'

  submit(): DocumentState {
    return this
  }

  // [approve]
  approve(): DocumentState {
    console.log('Review approved — publishing')
    return new PublishedState()
  }
  // [/approve]

  // [reject]
  reject(): DocumentState {
    console.log('Review rejected — back for changes')
    return new RejectedState()
  }
  // [/reject]

  revise(): DocumentState {
    return this
  }
}
// [/review]

// [published]
class PublishedState implements DocumentState {
  readonly name = 'Published'

  // Published is terminal: every action is a no-op.
  submit(): DocumentState {
    return this
  }

  approve(): DocumentState {
    return this
  }

  reject(): DocumentState {
    return this
  }

  revise(): DocumentState {
    return this
  }
}
// [/published]

// [rejected]
class RejectedState implements DocumentState {
  readonly name = 'Rejected'

  submit(): DocumentState {
    return this
  }

  approve(): DocumentState {
    return this
  }

  reject(): DocumentState {
    return this
  }

  // [revise]
  revise(): DocumentState {
    console.log('Revised — back to Draft')
    return new DraftState()
  }
  // [/revise]
}
// [/rejected]

// [document]
class Document {
  // [holds]
  private state: DocumentState = new DraftState()
  // [/holds]

  get status(): string {
    return this.state.name
  }

  // [delegate]
  submit() {
    this.state = this.state.submit()
  }

  approve() {
    this.state = this.state.approve()
  }

  reject() {
    this.state = this.state.reject()
  }

  revise() {
    this.state = this.state.revise()
  }
  // [/delegate]
}
// [/document]

// [client]
// Usage
const doc = new Document()
console.log(doc.status) // "Draft"

doc.submit()
console.log(doc.status) // "InReview"

doc.reject()
console.log(doc.status) // "Rejected"

doc.revise()
console.log(doc.status) // "Draft"

doc.submit()
console.log(doc.status) // "InReview"

doc.approve()
console.log(doc.status) // "Published"

doc.submit() // ignored — Published is terminal
console.log(doc.status) // "Published"
// [/client]
