// Usage
// [usage]
var registry = new ShapeRegistry();
registry.Register("circle", new Circle(5, new Style("black", 1)));
registry.Register("rectangle", new Rectangle(10, 20, new Style("blue", 2)));

var myCircle = registry.Clone("circle");
myCircle.Style.Color = "red"; // safe through the Shape interface alone: style is its own deep copy
((Circle)myCircle).Radius = 50; // a shape-specific tweak still needs the concrete type

var myRect = (Rectangle)registry.Clone("rectangle");
myRect.Width = 100;
// [/usage]

// [style]
class Style(string color, int lineWidth)
{
    public string Color { get; set; } = color;
    public int LineWidth { get; set; } = lineWidth;

    public Style Clone() => new(Color, LineWidth);
}
// [/style]

// [prototype]
interface IShape
{
    Style Style { get; set; }
    IShape Clone();
}
// [/prototype]

// [circle]
class Circle(double radius, Style style) : IShape
{
    public double Radius { get; set; } = radius;
    public Style Style { get; set; } = style;

    // [circleClone]
    public IShape Clone()
    {
        // Deep copy: a fresh Style, not a shared reference to the original's.
        return new Circle(Radius, Style.Clone());
    }
    // [/circleClone]
}
// [/circle]

// [rectangle]
class Rectangle(double width, double height, Style style) : IShape
{
    public double Width { get; set; } = width;
    public double Height { get; set; } = height;
    public Style Style { get; set; } = style;

    // [rectangleClone]
    public IShape Clone()
    {
        return new Rectangle(Width, Height, Style.Clone());
    }
    // [/rectangleClone]
}
// [/rectangle]

// [registry]
class ShapeRegistry
{
    // [holds]
    private readonly Dictionary<string, IShape> _prototypes = new();
    // [/holds]

    // [seed]
    public void Register(string key, IShape prototype)
    {
        _prototypes[key] = prototype;
    }
    // [/seed]

    // [registryClone]
    public IShape Clone(string key)
    {
        if (!_prototypes.TryGetValue(key, out var prototype))
            throw new ArgumentException($"Unknown prototype: {key}");
        return prototype.Clone();
    }
    // [/registryClone]
}
// [/registry]
