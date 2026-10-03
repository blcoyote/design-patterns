// Usage
// [client]
var doc = new Document();
Console.WriteLine(doc.Status); // "Draft"

doc.Submit();
Console.WriteLine(doc.Status); // "InReview"

doc.Reject();
Console.WriteLine(doc.Status); // "Rejected"

doc.Revise();
Console.WriteLine(doc.Status); // "Draft"

doc.Submit();
Console.WriteLine(doc.Status); // "InReview"

doc.Approve();
Console.WriteLine(doc.Status); // "Published"

doc.Submit(); // ignored — Published is terminal
Console.WriteLine(doc.Status); // "Published"
// [/client]

// [documentState]
interface IDocumentState
{
    string Name { get; }
    IDocumentState Submit();
    IDocumentState Approve();
    IDocumentState Reject();
    IDocumentState Revise();
}
// [/documentState]

// [draft]
class DraftState : IDocumentState
{
    public string Name => "Draft";

    // [submit]
    public IDocumentState Submit()
    {
        Console.WriteLine("Draft submitted for review");
        return new InReviewState();
    }
    // [/submit]

    public IDocumentState Approve() => this; // not a valid transition from Draft

    public IDocumentState Reject() => this;

    public IDocumentState Revise() => this;
}
// [/draft]

// [review]
class InReviewState : IDocumentState
{
    public string Name => "InReview";

    public IDocumentState Submit() => this;

    // [approve]
    public IDocumentState Approve()
    {
        Console.WriteLine("Review approved — publishing");
        return new PublishedState();
    }
    // [/approve]

    // [reject]
    public IDocumentState Reject()
    {
        Console.WriteLine("Review rejected — back for changes");
        return new RejectedState();
    }
    // [/reject]

    public IDocumentState Revise() => this;
}
// [/review]

// [published]
class PublishedState : IDocumentState
{
    public string Name => "Published";

    // Published is terminal: every action is a no-op.
    public IDocumentState Submit() => this;

    public IDocumentState Approve() => this;

    public IDocumentState Reject() => this;

    public IDocumentState Revise() => this;
}
// [/published]

// [rejected]
class RejectedState : IDocumentState
{
    public string Name => "Rejected";

    public IDocumentState Submit() => this;

    public IDocumentState Approve() => this;

    public IDocumentState Reject() => this;

    // [revise]
    public IDocumentState Revise()
    {
        Console.WriteLine("Revised — back to Draft");
        return new DraftState();
    }
    // [/revise]
}
// [/rejected]

// [document]
class Document
{
    // [holds]
    private IDocumentState _state = new DraftState();
    // [/holds]

    public string Status => _state.Name;

    // [delegate]
    public void Submit() => _state = _state.Submit();

    public void Approve() => _state = _state.Approve();

    public void Reject() => _state = _state.Reject();

    public void Revise() => _state = _state.Revise();
    // [/delegate]
}
// [/document]
