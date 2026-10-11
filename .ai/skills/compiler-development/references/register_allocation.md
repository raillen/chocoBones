# Register Allocation

Register allocation is the process of assigning a large number of target program variables onto a small number of CPU registers.

## Graph Coloring Approach

The most common modern approach is based on graph coloring. 
1. **Liveness Analysis:** First, we determine the live ranges of all variables. A variable is live from the point it is defined until its last use.
2. **Interference Graph:** We build an interference graph where nodes represent variables (virtual registers). An edge connects two nodes if their live ranges overlap (they interfere), meaning they cannot occupy the same physical register simultaneously.
3. **Coloring:** We attempt to color the graph using $K$ colors, where $K$ is the number of available physical registers. Adjacent nodes must have different colors.
4. **Spilling:** If the graph cannot be colored with $K$ colors, some variables must be "spilled" to memory (the stack). We add load/store instructions around the uses/defs of the spilled variables and repeat the process.

## Linear Scan

For Just-In-Time (JIT) compilers where compilation speed is critical, Linear Scan is preferred over Graph Coloring.
- It sorts live intervals by their start point.
- It iterates through the sorted intervals, maintaining a list of active intervals.
- When a new interval starts, it assigns a free register. If no registers are free, it spills the active interval that ends furthest in the future.
