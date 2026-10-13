import type { Vec2 } from "../core/types";

export interface ArapHandle {
  vertex: number;
  target: Vec2;
}

export interface ArapSolveOptions {
  /** Local/global steps, default 16; capped at 64 to bound interactive work. */
  iterations?: number;
  /** Relative CG and pose convergence tolerance, default 1e-7; minimum 1e-12. */
  tolerance?: number;
  /** CG steps per coordinate/global step, default min(free vertices, 256); capped at 1024. */
  maxCgIterations?: number;
}

export interface ArapSolver {
  solve(handles: readonly ArapHandle[], options?: ArapSolveOptions): Vec2[];
}

interface Edge {
  a: number;
  b: number;
  x: number;
  y: number;
}

interface DirichletSystem {
  key: string;
  active: Uint8Array;
  freeVertices: number[];
  diagonal: Float64Array;
  offsets: Int32Array;
  columns: Int32Array;
}

function finitePoint(point: Vec2, name: string): void {
  if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    throw new TypeError(`${name} must contain two finite coordinates`);
  }
}

function boundedIterations(value: number | undefined, fallback: number, cap: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
  return Math.min(value, cap);
}

/**
 * Vertex-spokes ARAP on the undirected edges of a triangle mesh. Every unique
 * edge has weight 1: these are positive uniform weights, not cotangent weights.
 *
 * The local step fits proper 2D rotations (the atan2 polar/SVD solution); the
 * global step solves the Dirichlet graph Laplacian using diagonally
 * preconditioned sparse conjugate gradients. Handles are exact, never penalty
 * constraints. Storage is O(vertices + edges), with no dense N × N matrix.
 *
 * Rest positions/topology are copied once. A solve always starts from a rigid
 * fit of its handles, so playback/scrubbing is deterministic and independent
 * of earlier calls. Components without handles stay at rest; a component with
 * one handle translates rigidly. Degenerate triangles contribute no edges.
 * Use a few hundred vertices for interactive puppets; 4096 is the hard limit.
 */
export function createArapSolver(
  vertices: readonly Vec2[],
  triangles: readonly [number, number, number][],
): ArapSolver {
  const count = vertices.length;
  if (count > 4096) throw new RangeError("ARAP supports at most 4096 vertices; use a coarser deformation mesh");
  const rest = vertices.map((point, index): Vec2 => {
    finitePoint(point, `Vertex ${index}`);
    return [point[0], point[1]];
  });
  const adjacent: number[][] = Array.from({ length: count }, () => []);
  const edges: Edge[] = [];
  const seen = new Set<number>();
  for (const triangle of triangles) {
    if (triangle.length !== 3 || triangle.some((index) => !Number.isInteger(index) || index < 0 || index >= count)) {
      throw new RangeError("Triangle indices must reference existing vertices");
    }
    const [a, b, c] = triangle;
    const pa = rest[a]!;
    const pb = rest[b]!;
    const pc = rest[c]!;
    const dx = pb[0] - pa[0];
    const dy = pb[1] - pa[1];
    const ex = pc[0] - pa[0];
    const ey = pc[1] - pa[1];
    const scale = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(ex), Math.abs(ey));
    if (!Number.isFinite(scale)) throw new RangeError("Rest coordinate range is too large for ARAP");
    // Relative area avoids overflow/underflow and ignores numerical zero-area faces.
    if (scale === 0 || Math.abs((dx / scale) * (ey / scale) - (dy / scale) * (ex / scale)) <= 16 * Number.EPSILON) continue;
    for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const low = Math.min(u, v);
      const high = Math.max(u, v);
      const key = low * count + high;
      if (seen.has(key)) continue;
      seen.add(key);
      adjacent[low]!.push(high);
      adjacent[high]!.push(low);
      edges.push({ a: low, b: high, x: rest[low]![0] - rest[high]![0], y: rest[low]![1] - rest[high]![1] });
    }
  }
  // Stable order also makes equivalent triangle/handle orderings reproducible.
  for (const neighbors of adjacent) neighbors.sort((a, b) => a - b);
  edges.sort((a, b) => a.a - b.a || a.b - b.b);
  const componentOf = new Int32Array(count).fill(-1);
  const components: number[][] = [];
  for (let vertex = 0; vertex < count; vertex++) {
    if (componentOf[vertex] !== -1) continue;
    const component = [vertex];
    const id = components.length;
    componentOf[vertex] = id;
    for (let cursor = 0; cursor < component.length; cursor++) {
      for (const neighbor of adjacent[component[cursor]!]!) {
        if (componentOf[neighbor] !== -1) continue;
        componentOf[neighbor] = id;
        component.push(neighbor);
      }
    }
    components.push(component);
  }
  let cachedSystem: DirichletSystem | undefined;

  function systemFor(handles: readonly ArapHandle[], grouped: readonly ArapHandle[][]): DirichletSystem {
    const key = handles.map((handle) => handle.vertex).join(",");
    if (cachedSystem?.key === key) return cachedSystem;
    const fixed = new Uint8Array(count);
    for (const handle of handles) fixed[handle.vertex] = 1;
    const active = new Uint8Array(count);
    const freeVertices: number[] = [];
    const freeIndex = new Int32Array(count).fill(-1);
    for (let vertex = 0; vertex < count; vertex++) {
      if (grouped[componentOf[vertex]!]!.length < 2) continue;
      active[vertex] = 1;
      if (fixed[vertex]) continue;
      freeIndex[vertex] = freeVertices.length;
      freeVertices.push(vertex);
    }
    const diagonal = new Float64Array(freeVertices.length);
    const offsets = new Int32Array(freeVertices.length + 1);
    const columns: number[] = [];
    for (let row = 0; row < freeVertices.length; row++) {
      const vertex = freeVertices[row]!;
      diagonal[row] = adjacent[vertex]!.length;
      for (const neighbor of adjacent[vertex]!) {
        const column = freeIndex[neighbor]!;
        if (column !== -1) columns.push(column);
      }
      offsets[row + 1] = columns.length;
    }
    cachedSystem = { key, active, freeVertices, diagonal, offsets, columns: Int32Array.from(columns) };
    return cachedSystem;
  }

  return {
    solve(handles, options = {}) {
      const iterations = boundedIterations(options.iterations, 16, 64, "iterations");
      const tolerance = options.tolerance ?? 1e-7;
      if (!Number.isFinite(tolerance) || tolerance <= 0) throw new RangeError("tolerance must be finite and positive");
      const relativeTolerance = Math.max(tolerance, 1e-12);
      const unique = new Map<number, ArapHandle>();
      for (const handle of handles) {
        if (!Number.isInteger(handle.vertex) || handle.vertex < 0 || handle.vertex >= count) {
          throw new RangeError("Handle vertex must reference an existing vertex");
        }
        finitePoint(handle.target, `Handle ${handle.vertex}`);
        const existing = unique.get(handle.vertex);
        if (existing && (existing.target[0] !== handle.target[0] || existing.target[1] !== handle.target[1])) {
          throw new RangeError("A vertex cannot have conflicting handle targets");
        }
        unique.set(handle.vertex, { vertex: handle.vertex, target: [handle.target[0], handle.target[1]] });
      }
      const sorted = [...unique.values()].sort((a, b) => a.vertex - b.vertex);
      const grouped: ArapHandle[][] = Array.from({ length: components.length }, () => []);
      for (const handle of sorted) grouped[componentOf[handle.vertex]!]!.push(handle);
      const system = systemFor(sorted, grouped);
      const maxCg = boundedIterations(options.maxCgIterations, Math.min(Math.max(system.freeVertices.length, 1), 256), 1024, "maxCgIterations");
      const current = rest.map((point): Vec2 => [point[0], point[1]]);
      // Rest is the zero-energy solution. Preserve its exact stored numbers so
      // a neutral texture does not acquire rounding changes during re-rendering.
      if (sorted.every((handle) => handle.target[0] === rest[handle.vertex]![0] && handle.target[1] === rest[handle.vertex]![1])) {
        return current;
      }
      const cosines = new Float64Array(count).fill(1);
      const sines = new Float64Array(count);
      const translations = components.map((): Vec2 => [0, 0]);
      const scales = new Float64Array(components.length).fill(1);

      // Least-squares proper rigid fit avoids poor convergence for large rotations.
      for (let id = 0; id < components.length; id++) {
        const componentHandles = grouped[id]!;
        if (componentHandles.length === 0) continue;
        let rx = 0;
        let ry = 0;
        let tx = 0;
        let ty = 0;
        for (const handle of componentHandles) {
          rx += rest[handle.vertex]![0] / componentHandles.length;
          ry += rest[handle.vertex]![1] / componentHandles.length;
          tx += handle.target[0] / componentHandles.length;
          ty += handle.target[1] / componentHandles.length;
        }
        let restScale = 0;
        let targetScale = 0;
        for (const vertex of components[id]!) {
          restScale = Math.max(restScale, Math.hypot(rest[vertex]![0] - rx, rest[vertex]![1] - ry));
        }
        for (const handle of componentHandles) {
          targetScale = Math.max(targetScale, Math.hypot(handle.target[0] - tx, handle.target[1] - ty));
        }
        if (!Number.isFinite(restScale) || !Number.isFinite(targetScale)) {
          throw new RangeError("Deformation coordinate range is too large for ARAP");
        }
        restScale ||= 1;
        targetScale ||= 1;
        scales[id] = restScale;
        let dot = 0;
        let cross = 0;
        for (const handle of componentHandles) {
          const px = (rest[handle.vertex]![0] - rx) / restScale;
          const py = (rest[handle.vertex]![1] - ry) / restScale;
          const qx = (handle.target[0] - tx) / targetScale;
          const qy = (handle.target[1] - ty) / targetScale;
          dot += px * qx + py * qy;
          cross += px * qy - py * qx;
        }
        const angle = Math.atan2(cross, dot);
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        translations[id] = [tx, ty];
        for (const vertex of components[id]!) {
          const x = (rest[vertex]![0] - rx) / restScale;
          const y = (rest[vertex]![1] - ry) / restScale;
          // Solve around the target centroid: world translation must not inflate
          // the CG relative tolerance or hide a small but visible deformation.
          // Normalize each component so differently sized islands stay useful.
          current[vertex] = [cosine * x - sine * y, sine * x + cosine * y];
          cosines[vertex] = cosine;
          sines[vertex] = sine;
        }
      }
      for (const handle of sorted) {
        const component = componentOf[handle.vertex]!;
        const translation = translations[component]!;
        current[handle.vertex] = [(handle.target[0] - translation[0]) / scales[component]!, (handle.target[1] - translation[1]) / scales[component]!];
      }
      function finish(): Vec2[] {
        const result = current.map((point, vertex): Vec2 => {
          const component = componentOf[vertex]!;
          const translation = translations[component]!;
          const transformed: Vec2 = [point[0] * scales[component]! + translation[0], point[1] * scales[component]! + translation[1]];
          finitePoint(transformed, "Deformation result");
          return transformed;
        });
        // Restore the original numbers, including after centroid round trips.
        for (const handle of sorted) result[handle.vertex] = [handle.target[0], handle.target[1]];
        return result;
      }
      if (system.freeVertices.length === 0) return finish();

      const bX = new Float64Array(count);
      const bY = new Float64Array(count);
      const rhsX = new Float64Array(system.freeVertices.length);
      const rhsY = new Float64Array(system.freeVertices.length);
      const solutionX = new Float64Array(system.freeVertices.length);
      const solutionY = new Float64Array(system.freeVertices.length);
      const residual = new Float64Array(system.freeVertices.length);
      const direction = new Float64Array(system.freeVertices.length);
      const product = new Float64Array(system.freeVertices.length);
      const activeEdges = edges.filter((edge) => system.active[edge.a]);
      const edgeX = Float64Array.from(activeEdges, (edge) => edge.x / scales[componentOf[edge.a]!]!);
      const edgeY = Float64Array.from(activeEdges, (edge) => edge.y / scales[componentOf[edge.a]!]!);
      const localDots = new Float64Array(count);
      const localCrosses = new Float64Array(count);
      const free = new Uint8Array(count);
      for (const vertex of system.freeVertices) free[vertex] = 1;

      function multiply(input: Float64Array, output: Float64Array): void {
        for (let row = 0; row < input.length; row++) {
          let value = system.diagonal[row]! * input[row]!;
          for (let cursor = system.offsets[row]!; cursor < system.offsets[row + 1]!; cursor++) {
            value -= input[system.columns[cursor]!]!;
          }
          output[row] = value;
        }
      }

      function cg(rhs: Float64Array, solution: Float64Array): void {
        multiply(solution, product);
        let rhsNorm = 0;
        let residualNorm = 0;
        let rz = 0;
        for (let row = 0; row < rhs.length; row++) {
          const r = rhs[row]! - product[row]!;
          residual[row] = r;
          direction[row] = r / system.diagonal[row]!;
          rhsNorm += rhs[row]! * rhs[row]!;
          residualNorm += r * r;
          rz += r * direction[row]!;
        }
        const threshold = relativeTolerance ** 2 * Math.max(rhsNorm, 1e-24);
        if (residualNorm <= threshold) return;
        for (let step = 0; step < maxCg; step++) {
          multiply(direction, product);
          let denominator = 0;
          for (let row = 0; row < rhs.length; row++) denominator += direction[row]! * product[row]!;
          if (!(denominator > 0) || !Number.isFinite(denominator)) break;
          const alpha = rz / denominator;
          let nextRz = 0;
          residualNorm = 0;
          for (let row = 0; row < rhs.length; row++) {
            solution[row] = solution[row]! + alpha * direction[row]!;
            residual[row] = residual[row]! - alpha * product[row]!;
            residualNorm += residual[row]! ** 2;
            nextRz += residual[row]! ** 2 / system.diagonal[row]!;
          }
          if (residualNorm <= threshold) return;
          const beta = nextRz / rz;
          for (let row = 0; row < rhs.length; row++) {
            direction[row] = residual[row]! / system.diagonal[row]! + beta * direction[row]!;
          }
          rz = nextRz;
        }
      }

      for (let iteration = 0; iteration < iterations; iteration++) {
        // argmin_R sum_j ||(q_i-q_j) - R_i(p_i-p_j)||², R_i ∈ SO(2).
        // An edge's covariance is identical at its two ends because both rest
        // and pose differences reverse sign. Accumulate it once, without
        // changing the uniform-weight vertex-spokes objective.
        localDots.fill(0);
        localCrosses.fill(0);
        for (let index = 0; index < activeEdges.length; index++) {
          const edge = activeEdges[index]!;
          const qx = current[edge.a]![0] - current[edge.b]![0];
          const qy = current[edge.a]![1] - current[edge.b]![1];
          const dot = edgeX[index]! * qx + edgeY[index]! * qy;
          const cross = edgeX[index]! * qy - edgeY[index]! * qx;
          localDots[edge.a] = localDots[edge.a]! + dot;
          localDots[edge.b] = localDots[edge.b]! + dot;
          localCrosses[edge.a] = localCrosses[edge.a]! + cross;
          localCrosses[edge.b] = localCrosses[edge.b]! + cross;
        }
        for (let vertex = 0; vertex < count; vertex++) {
          if (!system.active[vertex]) continue;
          const dot = localDots[vertex]!;
          const cross = localCrosses[vertex]!;
          if (dot === 0 && cross === 0) continue; // Keep prior proper rotation for collapsed neighborhoods.
          const angle = Math.atan2(cross, dot);
          cosines[vertex] = Math.cos(angle);
          sines[vertex] = Math.sin(angle);
        }
        bX.fill(0);
        bY.fill(0);
        for (let index = 0; index < activeEdges.length; index++) {
          const edge = activeEdges[index]!;
          const cosine = (cosines[edge.a]! + cosines[edge.b]!) * 0.5;
          const sine = (sines[edge.a]! + sines[edge.b]!) * 0.5;
          const x = cosine * edgeX[index]! - sine * edgeY[index]!;
          const y = sine * edgeX[index]! + cosine * edgeY[index]!;
          bX[edge.a] = bX[edge.a]! + x;
          bX[edge.b] = bX[edge.b]! - x;
          bY[edge.a] = bY[edge.a]! + y;
          bY[edge.b] = bY[edge.b]! - y;
        }
        for (let row = 0; row < system.freeVertices.length; row++) {
          const vertex = system.freeVertices[row]!;
          let x = bX[vertex]!;
          let y = bY[vertex]!;
          for (const neighbor of adjacent[vertex]!) {
            if (free[neighbor]) continue;
            x += current[neighbor]![0];
            y += current[neighbor]![1];
          }
          rhsX[row] = x;
          rhsY[row] = y;
          solutionX[row] = current[vertex]![0];
          solutionY[row] = current[vertex]![1];
        }
        cg(rhsX, solutionX);
        cg(rhsY, solutionY);
        let largestChange = 0;
        for (let row = 0; row < system.freeVertices.length; row++) {
          const vertex = system.freeVertices[row]!;
          const x = solutionX[row]!;
          const y = solutionY[row]!;
          if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError("Deformation coordinate range is too large for ARAP");
          largestChange = Math.max(largestChange, Math.hypot(x - current[vertex]![0], y - current[vertex]![1]));
          current[vertex] = [x, y];
        }
        if (largestChange <= relativeTolerance) break;
      }
      return finish();
    },
  };
}

/** One-shot convenience; retain createArapSolver for repeated poses of the same mesh. */
export function solveArapMesh(
  vertices: readonly Vec2[],
  triangles: readonly [number, number, number][],
  handles: readonly ArapHandle[],
  options?: ArapSolveOptions,
): Vec2[] {
  return createArapSolver(vertices, triangles).solve(handles, options);
}
