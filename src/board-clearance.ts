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
  const [ground, ...islands] = layout.road.outlines;
  const obstacles = layout.road.obstacles ?? [];
  const { centers, depth } = measureTrack(layout);
  const w = layout.halfWidth * 0.982;
  const h = layout.halfHeight * 0.982;
  const r = 0.19;
  return centers.map(({ x, y }, id) => {
    const polygon: Polygon = [
      [x - w * (1 - r / 2), y],
      [x - w * (1 - r), y - h * r],
      [x - w * r, y - h * (1 - r)],
      [x, y - h * (1 - r / 2)],
      [x + w * r, y - h * (1 - r)],
      [x + w * (1 - r), y - h * r],
      [x + w * (1 - r / 2), y],
      [x + w * (1 - r / 2), y + depth],
      [x + w * (1 - r), y + h * r + depth],
      [x + w * r, y + h * (1 - r) + depth],
      [x, y + h * (1 - r / 2) + depth],
      [x - w * r, y + h * (1 - r) + depth],
      [x - w * (1 - r), y + h * r + depth],
      [x - w * (1 - r / 2), y + depth],
    ];
    const onRoad =
      contains(ground, [x, y]) &&
      !islands.some((island) => contains(island, [x, y]));
    const hitsScenery = obstacles.some(
      (obstacle) =>
        contains(obstacle, polygon[0]) ||
        contains(polygon, obstacle[0]) ||
        outlinesIntersect(polygon, obstacle),
    );
    return {
      id,
      polygon,
      onRoad,
      hitsScenery,
      overlaps: !onRoad || hitsScenery,
    };
  });
}
