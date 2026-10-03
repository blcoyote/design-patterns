// [usage]
var forest = new Forest();
var random = new Random();
for (var i = 0; i < 5_000; i++)
{
    forest.Plant(random.NextDouble() * 1000, random.NextDouble() * 1000, random.NextDouble() * 50, "Oak", "#2f6b3a", "rough-bark.png");
}
for (var i = 0; i < 5_000; i++)
{
    forest.Plant(random.NextDouble() * 1000, random.NextDouble() * 1000, random.NextDouble() * 50, "Pine", "#1f4d2e", "needle-bark.png");
}
// 10,000 Tree objects on the heap, backed by just two shared ConcreteTreeType instances
// [/usage]

// [canvas]
interface ICanvas
{
    void PaintTree(string color, string texture, double x, double y, double age);
}
// [/canvas]

// [treeType]
interface ITreeType
{
    void Draw(ICanvas canvas, double x, double y, double age);
}
// [/treeType]

// [concreteType]
class ConcreteTreeType : ITreeType
{
    // Intrinsic state: shared and identical for every tree of this species.
    private readonly string _name;
    private readonly string _color;
    private readonly string _texture;

    public ConcreteTreeType(string name, string color, string texture)
    {
        _name = name;
        _color = color;
        _texture = texture;
    }

    // [draw]
    public void Draw(ICanvas canvas, double x, double y, double age)
    {
        // Extrinsic state (x, y, age) arrives as arguments — it is never stored here.
        canvas.PaintTree(_color, _texture, x, y, age);
    }
    // [/draw]
}
// [/concreteType]

// [factory]
class TreeTypeFactory
{
    private readonly Dictionary<string, ConcreteTreeType> _pool = new();

    // [getTreeType]
    public ITreeType GetTreeType(string name, string color, string texture)
    {
        var key = $"{name}:{color}:{texture}";
        if (!_pool.TryGetValue(key, out var type))
        {
            type = new ConcreteTreeType(name, color, texture); // cache miss — build once
            _pool[key] = type;
        }
        return type; // cache hit — reuse the existing flyweight
    }
    // [/getTreeType]

    public int PoolSize => _pool.Count;
}
// [/factory]

// [tree]
class Tree
{
    // Extrinsic state: unique per tree, stored outside the flyweight.
    private readonly double _x;
    private readonly double _y;
    private readonly double _age;
    // [holds]
    private readonly ITreeType _type; // shared reference, not a private copy
    // [/holds]

    public Tree(double x, double y, double age, ITreeType type)
    {
        _x = x;
        _y = y;
        _age = age;
        _type = type;
    }

    // [treeDraw]
    public void Render(ICanvas canvas)
    {
        _type.Draw(canvas, _x, _y, _age);
    }
    // [/treeDraw]
}
// [/tree]

// [forest]
class Forest
{
    private readonly List<Tree> _trees = new();
    private readonly TreeTypeFactory _factory = new();

    // [plant]
    public void Plant(double x, double y, double age, string name, string color, string texture)
    {
        var type = _factory.GetTreeType(name, color, texture);
        _trees.Add(new Tree(x, y, age, type));
    }
    // [/plant]

    // [render]
    public void Render(ICanvas canvas)
    {
        foreach (var tree in _trees) tree.Render(canvas);
    }
    // [/render]
}
// [/forest]
