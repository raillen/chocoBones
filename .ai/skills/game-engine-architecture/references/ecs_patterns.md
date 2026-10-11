# Entity-Component-System (ECS) Patterns

The ECS architecture pattern is the modern standard for game engine architectures, replacing deep object-oriented inheritance hierarchies with composition and data-oriented design.

## Core Concepts

1. **Entity**: A general-purpose object. In a pure ECS, an Entity is merely an ID (usually an integer). It contains no data and no logic.
2. **Component**: Raw data for one aspect of the object, and how it interacts with the world (e.g., Position, Velocity, Health, Renderable). Components contain *no logic*.
3. **System**: Logic that performs work on Entities that have a specific subset of Components. For example, a `PhysicsSystem` might iterate over all Entities that have both a `Position` component and a `Velocity` component.

## Data Layout Strategies

To maximize cache locality, game engines use different strategies to lay out components in memory.

### 1. Archetypes
Entities with the exact same set of components belong to the same "Archetype". Archetypes store data in struct-of-arrays (SoA) format. Iterating over an archetype is extremely fast because data is tightly packed, but adding or removing a component from an entity requires moving all of its components to a different archetype.

### 2. Sparse Sets
Each component type has its own Sparse Set. A Sparse Set consists of a dense array of component data, a dense array of entity IDs, and a sparse array mapping Entity IDs to indices in the dense arrays. Adding/removing components is very fast, but iterating over multiple components requires intersecting the dense arrays, which can introduce cache misses.
