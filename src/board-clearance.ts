import { measureTrack } from "./board-track";
import type { BoardLayout, MapPoint } from "./data/board-layout";

type Polygon = readonly MapPoint[];

function contains(polygon: Polygon, [x, y]: MapPoint) {
  let inside = false;
  for (const [[ax, ay], [bx, by]] of edges(polygon)) {
    if (ay > y !== by > y && x < ax + ((bx - ax) * (y - ay)) / (by - ay))
      inside = !inside;
  }
  return inside;
}

function edges(polygon: Polygon) {
  return polygon.map(
    (point, i) => [point, polygon[(i + 1) % polygon.length]] as const,
  );
}

function intersects(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint) {
  for (const axis of [0, 1] as const) {
    if (
      Math.max(a[axis], b[axis]) < Math.min(c[axis], d[axis]) ||
      Math.max(c[axis], d[axis]) < Math.min(a[axis], b[axis])
    )
      return false;
  }
  const cross = ([ax, ay]: MapPoint, [bx, by]: MapPoint, [cx, cy]: MapPoint) =>
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return (
    cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
  );
}

function outlinesIntersect(a: Polygon, b: Polygon) {
  return edges(a).some(([p, q]) =>
    edges(b).some(([r, s]) => intersects(p, q, r, s)),
  );
}

export function paverClearance(layout: BoardLayout) {
  if (!layout.road) return [];
  const [ground, ...obstacles] = layout.road.outlines;
  const { centers } = measureTrack(layout);
  const w = layout.halfWidth * 0.982;
  const h = layout.halfHeight * 0.982;
  return centers.map(({ x, y }, id) => {
    const polygon: Polygon = [
      [x - w, y],
      [x, y - h],
      [x + w, y],
      [x, y + h],
    ];
    const overlaps =
      polygon.some((point) => !contains(ground, point)) ||
      outlinesIntersect(polygon, ground) ||
      obstacles.some(
        (obstacle) =>
          contains(obstacle, polygon[0]) ||
          contains(polygon, obstacle[0]) ||
          outlinesIntersect(polygon, obstacle),
      );
    return { id, polygon, overlaps };
  });
}
