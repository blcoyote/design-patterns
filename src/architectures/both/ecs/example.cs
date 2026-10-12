using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

// [usage]
var world = new World();

// Four entities, each with a different set of components.
var hero = world.Spawn();
world.Names[hero] = new Name { Value = "hero" };
world.Positions[hero] = new Position { X = 0 };
world.Velocities[hero] = new Velocity { Dx = 1 };
world.Healths[hero] = new Health { Hp = 10 };

var goblin = world.Spawn();
world.Names[goblin] = new Name { Value = "goblin" };
world.Positions[goblin] = new Position { X = 5 };
world.Velocities[goblin] = new Velocity { Dx = -1 };
world.Healths[goblin] = new Health { Hp = 2 };

// The tree has a Name and a Position only: for now it cannot move, and it cannot be hurt.
var tree = world.Spawn();
world.Names[tree] = new Name { Value = "tree" };
world.Positions[tree] = new Position { X = 2 };

// The fire stands still and burns whatever with Health stands on it.
var fire = world.Spawn();
world.Names[fire] = new Name { Value = "fire" };
world.Positions[fire] = new Position { X = 3 };
world.Hazards[fire] = new Hazard { Damage = 2 };

for (var t = 1; t <= 3; t++)
{
    GameLoop.Tick(world);
    Console.WriteLine(FormattableString.Invariant($"tick {t}: {GameLoop.Describe(world)}"));
}

// Behaviour changes by adding data: with a Velocity the tree now matches the movement query.
world.Velocities[tree] = new Velocity { Dx = 1 };
Console.WriteLine("[world] tree gets Velocity(+1)");
GameLoop.Tick(world);
Console.WriteLine(FormattableString.Invariant($"tick 4: {GameLoop.Describe(world)}"));

Console.WriteLine(FormattableString.Invariant(
    $"components: position {world.Count(world.Positions)}, velocity {world.Count(world.Velocities)}, health {world.Count(world.Healths)}, hazard {world.Count(world.Hazards)}, name {world.Count(world.Names)}"));
// [/usage]

// [components]
// Components are plain data: properties and nothing else, no methods. There is no Hero, Goblin
// or Tree class anywhere in this file; what an entity is follows from which components it
// has. Positions are integers on a one-dimensional track. The classes are mutable on purpose,
// because the systems change X and Hp in place.
sealed class Name { public required string Value { get; set; } }
sealed class Position { public int X { get; set; } }
sealed class Velocity { public int Dx { get; set; } }
sealed class Health { public int Hp { get; set; } }

/// <summary>Damage dealt each tick to every entity with Health that stands at the same x.</summary>
sealed class Hazard { public int Damage { get; set; } }
// [/components]

// [world]
/// <summary>
/// The world: it hands out entity ids and keeps one store per component type, keyed by
/// entity id. An entity is only its id; it has no fields and no behaviour of its own.
///
/// Real engines (Unity's Entities package, Bevy, EnTT, flecs) keep components in dense
/// arrays, sparse sets or archetype tables so that iteration is cache friendly, and that
/// speed is a main reason ECS exists. This example keeps one Dictionary per type and sorts
/// the ids in every query, for clarity and so that all four languages print the same output.
/// It is not meant to be fast.
/// </summary>
sealed class World
{
    private int _nextId = 1;
    public readonly Dictionary<int, Name> Names = new();
    public readonly Dictionary<int, Position> Positions = new();
    public readonly Dictionary<int, Velocity> Velocities = new();
    public readonly Dictionary<int, Health> Healths = new();
    public readonly Dictionary<int, Hazard> Hazards = new();

    /// <summary>Returns the next entity id: 1, 2, 3, and so on.</summary>
    public int Spawn() => _nextId++;

    /// <summary>
    /// The ids that are in ALL the given stores, in ascending numeric order. Only presence is
    /// checked, so the component type does not matter (the non-generic IDictionary fits a
    /// Dictionary of any component class, and its keys are ints). The result is a new list (a
    /// snapshot), so a system may destroy entities while it loops over it.
    /// </summary>
    public List<int> Query(params IDictionary[] stores)
    {
        if (stores.Length == 0) return new List<int>();
        var first = stores[0];
        var rest = stores.Skip(1).ToList();
        var ids = first.Keys.Cast<int>().Where(id => rest.All(store => store.Contains(id))).ToList();
        // A Dictionary does not promise an enumeration order, so sort the ids.
        ids.Sort();
        return ids;
    }

    /// <summary>The entity's name. A named entity is assumed here: a missing name is a programmer bug.</summary>
    public string NameOf(int id)
    {
        if (!Names.TryGetValue(id, out var name))
        {
            throw new InvalidOperationException($"entity {id} has no Name");
        }
        return name.Value;
    }

    /// <summary>Removes the id from every store, so the entity is gone.</summary>
    public void Destroy(int id)
    {
        Names.Remove(id);
        Positions.Remove(id);
        Velocities.Remove(id);
        Healths.Remove(id);
        Hazards.Remove(id);
    }

    /// <summary>How many entities have a component in the given store.</summary>
    public int Count(IDictionary store) => store.Count;
}
// [/world]

// [movementSystem]
/// <summary>
/// Moves every entity that has both a Position and a Velocity. An entity with a Position
/// only, like the tree at first, is not in the query result, so it never moves.
/// </summary>
static class MovementSystem
{
    public static void Run(World world)
    {
        foreach (var id in world.Query(world.Positions, world.Velocities))
        {
            if (!world.Positions.TryGetValue(id, out var position)) continue;
            if (!world.Velocities.TryGetValue(id, out var velocity)) continue;
            position.X += velocity.Dx;
        }
    }
}
// [/movementSystem]

// [damageSystem]
/// <summary>
/// Every hazard hurts every entity that has a Health and stands at the same x. Entities
/// without Health are never touched, so a Position and a Hazard alone does nothing to them.
/// Both loops run in ascending id order, and the hazard loop is nested inside the health loop.
/// </summary>
static class DamageSystem
{
    public static void Run(World world)
    {
        foreach (var id in world.Query(world.Positions, world.Healths))
        {
            if (!world.Positions.TryGetValue(id, out var position)) continue;
            if (!world.Healths.TryGetValue(id, out var health)) continue;
            foreach (var hazardId in world.Query(world.Positions, world.Hazards))
            {
                if (!world.Positions.TryGetValue(hazardId, out var hazardPosition)) continue;
                if (!world.Hazards.TryGetValue(hazardId, out var hazard)) continue;
                if (hazardPosition.X != position.X) continue;
                health.Hp -= hazard.Damage;
                Console.WriteLine(FormattableString.Invariant(
                    $"[damage] {world.NameOf(id)} takes {hazard.Damage} at {position.X} (hp {health.Hp})"));
            }
        }
    }
}
// [/damageSystem]

// [deathSystem]
/// <summary>Destroys every entity whose Health has dropped to zero or below.</summary>
static class DeathSystem
{
    public static void Run(World world)
    {
        // The query result is a snapshot, so destroying while looping is safe.
        foreach (var id in world.Query(world.Healths))
        {
            if (!world.Healths.TryGetValue(id, out var health) || health.Hp > 0) continue;
            var name = world.NameOf(id);
            world.Destroy(id);
            Console.WriteLine($"[death] {name} removed");
        }
    }
}
// [/deathSystem]

// [gameLoop]
static class GameLoop
{
    /// <summary>
    /// The systems, in the order a tick runs them. Here they run one after another on one
    /// thread, in this fixed order (an array keeps its order). Real schedulers (Bevy's, Unity's
    /// job system) may run systems in parallel when the components they touch do not conflict;
    /// this example does not show that.
    /// </summary>
    public static readonly Action<World>[] Systems =
    {
        MovementSystem.Run,
        DamageSystem.Run,
        DeathSystem.Run,
    };

    /// <summary>One tick of the game: every system runs once over the whole world.</summary>
    public static void Tick(World world)
    {
        foreach (var system in Systems) system(world);
    }

    /// <summary>One line for the world: name@x for each named entity with a Position, plus its hp if it has Health.</summary>
    public static string Describe(World world)
    {
        var parts = world.Query(world.Names, world.Positions).Select(id =>
        {
            if (!world.Positions.TryGetValue(id, out var position))
            {
                throw new InvalidOperationException($"entity {id} has no Position");
            }
            var hp = world.Healths.TryGetValue(id, out var health)
                ? FormattableString.Invariant($" hp{health.Hp}")
                : "";
            return FormattableString.Invariant($"{world.NameOf(id)}@{position.X}{hp}");
        });
        return string.Join(", ", parts);
    }
}
// [/gameLoop]
