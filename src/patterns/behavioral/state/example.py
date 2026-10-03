from typing import Protocol


# [documentState]
class DocumentState(Protocol):
    @property
    def name(self) -> str: ...
    def submit(self) -> "DocumentState": ...
    def approve(self) -> "DocumentState": ...
    def reject(self) -> "DocumentState": ...
    def revise(self) -> "DocumentState": ...
# [/documentState]


# [draft]
class DraftState:
    name = "Draft"

    # [submit]
    def submit(self) -> DocumentState:
        print("Draft submitted for review")
        return InReviewState()
    # [/submit]

    def approve(self) -> DocumentState:
        return self  # not a valid transition from Draft

    def reject(self) -> DocumentState:
        return self

    def revise(self) -> DocumentState:
        return self
# [/draft]


# [review]
class InReviewState:
    name = "InReview"

    def submit(self) -> DocumentState:
        return self

    # [approve]
    def approve(self) -> DocumentState:
        print("Review approved — publishing")
        return PublishedState()
    # [/approve]

    # [reject]
    def reject(self) -> DocumentState:
        print("Review rejected — back for changes")
        return RejectedState()
    # [/reject]

    def revise(self) -> DocumentState:
        return self
# [/review]


# [published]
class PublishedState:
    name = "Published"

    # Published is terminal: every action is a no-op.
    def submit(self) -> DocumentState:
        return self

    def approve(self) -> DocumentState:
        return self

    def reject(self) -> DocumentState:
        return self

    def revise(self) -> DocumentState:
        return self
# [/published]


# [rejected]
class RejectedState:
    name = "Rejected"

    def submit(self) -> DocumentState:
        return self

    def approve(self) -> DocumentState:
        return self

    def reject(self) -> DocumentState:
        return self

    # [revise]
    def revise(self) -> DocumentState:
        print("Revised — back to Draft")
        return DraftState()
    # [/revise]
# [/rejected]


# [document]
class Document:
    # [holds]
    def __init__(self) -> None:
        self._state: DocumentState = DraftState()
    # [/holds]

    @property
    def status(self) -> str:
        return self._state.name

    # [delegate]
    def submit(self) -> None:
        self._state = self._state.submit()

    def approve(self) -> None:
        self._state = self._state.approve()

    def reject(self) -> None:
        self._state = self._state.reject()

    def revise(self) -> None:
        self._state = self._state.revise()
    # [/delegate]
# [/document]


# [client]
# Usage
doc = Document()
print(doc.status)  # "Draft"

doc.submit()
print(doc.status)  # "InReview"

doc.reject()
print(doc.status)  # "Rejected"

doc.revise()
print(doc.status)  # "Draft"

doc.submit()
print(doc.status)  # "InReview"

doc.approve()
print(doc.status)  # "Published"

doc.submit()  # ignored — Published is terminal
print(doc.status)  # "Published"
# [/client]
