// A real C# app might reach for pattern-matching switch expressions over
// element types instead of classic double dispatch, but we keep the
// explicit Visitor structure here for clarity.

// [build]
var circle = new Circle(3);
var rectangle = new Rectangle(4, 3);
var group = new Group();
group.Add(circle);
group.Add(rectangle);
// [/build]

// Usage: swap the operation without changing Circle, Rectangle or Group.
var areaCalculator = new AreaCalculator();
group.Accept(areaCalculator);
Console.WriteLine(areaCalculator.Total); // ≈ 40.27

var exporter = new JsonExporter();
group.Accept(exporter);
Console.WriteLine(exporter.Result()); // {"type":"group","children":[...]}

// [element]
interface IShape
{
    void Accept(IShapeVisitor visitor);
}
// [/element]

// [visitor]
interface IShapeVisitor
{
    void VisitCircle(Circle circle);
    void VisitRectangle(Rectangle rectangle);
    void VisitGroup(Group group);
}
// [/visitor]

// [circle]
class Circle(double radius) : IShape
{
    public double Radius { get; } = radius;

    public void Accept(IShapeVisitor visitor)
    {
        // [visitCircleMethod]
        visitor.VisitCircle(this); // hop 2: dispatches on the visitor's own class
        // [/visitCircleMethod]
    }
}
// [/circle]

// [rectangle]
class Rectangle(double width, double height) : IShape
{
    public double Width { get; } = width;
    public double Height { get; } = height;

    public void Accept(IShapeVisitor visitor)
    {
        // [visitRectangleMethod]
        visitor.VisitRectangle(this);
        // [/visitRectangleMethod]
    }
}
// [/rectangle]

// [group]
class Group : IShape
{
    private readonly List<IShape> _children = [];

    public void Add(IShape shape)
    {
        _children.Add(shape);
    }

    public int ChildCount => _children.Count;

    // [groupAccept]
    public void Accept(IShapeVisitor visitor)
    {
        foreach (var child in _children) child.Accept(visitor); // hop 1, per child
        // [visitGroupMethod]
        visitor.VisitGroup(this); // hop 2, for the group itself
        // [/visitGroupMethod]
    }
    // [/groupAccept]
}
// [/group]

// [areaCalculator]
class AreaCalculator : IShapeVisitor
{
    public double Total { get; private set; }

    public void VisitCircle(Circle circle)
    {
        Total += Math.PI * circle.Radius * circle.Radius;
    }

    public void VisitRectangle(Rectangle rectangle)
    {
        Total += rectangle.Width * rectangle.Height;
    }

    public void VisitGroup(Group group)
    {
        // Children already added themselves in above — nothing left to do here.
    }
}
// [/areaCalculator]

// [jsonExporter]
class JsonExporter : IShapeVisitor
{
    private readonly List<string> _parts = [];

    public void VisitCircle(Circle circle)
    {
        _parts.Add($"{{\"type\":\"circle\",\"r\":{circle.Radius}}}");
    }

    public void VisitRectangle(Rectangle rectangle)
    {
        _parts.Add($"{{\"type\":\"rectangle\",\"w\":{rectangle.Width},\"h\":{rectangle.Height}}}");
    }

    public void VisitGroup(Group group)
    {
        // Every child (leaf or nested group) left exactly one entry behind, so this
        // group's children are the last ChildCount entries — siblings stay untouched.
        var children = _parts.GetRange(_parts.Count - group.ChildCount, group.ChildCount);
        _parts.RemoveRange(_parts.Count - group.ChildCount, group.ChildCount);
        _parts.Add($"{{\"type\":\"group\",\"children\":[{string.Join(",", children)}]}}");
    }

    // Named Result(), not ToString() — keeps parity with the explicit,
    // non-overload-driven TypeScript original.
    public string Result() => _parts.Count > 0 ? _parts[0] : "{}";
}
// [/jsonExporter]
