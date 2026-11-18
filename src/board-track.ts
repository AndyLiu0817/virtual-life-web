import type { BoardLayout } from "./data/board-layout";

type Point = { x: number; y: number };
const groundScale = 0.62;

function tileGeometry(
  center: Point,
  tangent: number,
  length: number,
  width: number,
) {
  // Rotate on the ground plane first, then project that plane onto the map.
  const angle = Math.atan2(Math.sin(tangent) / groundScale, Math.cos(tangent));
  const upright = ((angle + 1.5 * Math.PI) % Math.PI) - Math.PI / 2;
  const along = { x: Math.cos(upright), y: groundScale * Math.sin(upright) };
  const across = { x: -Math.sin(upright), y: groundScale * Math.cos(upright) };
  const halfLength = length / (2 * Math.hypot(along.x, along.y));
  const halfWidth = width / 2;
  // Beveled corners keep the outline and the thin side readable at map scale.
  const corner = 2;
  const outline = [
    [-halfLength + corner, -halfWidth],
    [halfLength - corner, -halfWidth],
    [halfLength, -halfWidth + corner],
    [halfLength, halfWidth - corner],
    [halfLength - corner, halfWidth],
    [-halfLength + corner, halfWidth],
    [-halfLength, halfWidth - corner],
    [-halfLength, -halfWidth + corner],
  ];
  return {
    face: `M ${outline.map(([u, v]) => `${center.x + along.x * u + across.x * v},${center.y + along.y * u + across.y * v}`).join(" L ")} Z`,
    print: `matrix(${along.x} ${along.y} ${across.x} ${across.y} ${center.x} ${center.y})`,
    iconSize: Math.min(halfLength * 1.72, width * 0.87),
  };
}

export function measureTrack(layout: BoardLayout) {
  const centers = new Map<number, Point>();
  const pavers = new Map<number, ReturnType<typeof tileGeometry>>();
  const edges = new Map<string, (progress: number) => Point>();

  for (const track of layout.tracks) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", track.path);
    const length = path.getTotalLength();
    const point = (distance: number) => path.getPointAtLength(distance);
    const angle = (distance: number) => {
      const before = point(distance - 1);
      const after = point(distance + 1);
      return Math.atan2(after.y - before.y, after.x - before.x);
    };
    // Anchored landmarks split a track into equally spaced spans.
    const last = track.tiles.length - 1;
    const anchors = [
      [0, 0],
      ...track.tiles.flatMap((id, index) =>
        track.offsets?.[id] === undefined ? [] : [[index, track.offsets[id]]],
      ),
      [last, 1],
    ];
    const distances: number[] = [];
    for (let span = 1; span < anchors.length; span++) {
      const [from, start] = anchors[span - 1];
      const [to, end] = anchors[span];
      for (let i = from; i <= to; i++) {
        distances[i] =
          length * (start + ((end - start) * (i - from)) / (to - from));
      }
    }

    track.tiles.forEach((id, index) => {
      const distance = distances[index];
      const center = point(distance);
      const junction = index === 0 || index === last;
      if (!centers.has(id)) centers.set(id, center);
      if (index > 0) {
        const previous = track.tiles[index - 1];
        const start = distances[index - 1];
        const between = (progress: number) =>
          point(start + (distance - start) * progress);
        edges.set(`${previous}:${id}`, between);
        edges.set(`${id}:${previous}`, (progress) => between(1 - progress));
      }
      if (pavers.has(id)) return;

      const before = distance - (distances[index - 1] ?? -Infinity);
      const after = (distances[index + 1] ?? Infinity) - distance;
      const extent = Math.min(
        Math.min(before, after) * (junction ? 0.64 : 0.76),
        track.maxPaverLength ?? 43,
      );
      const width = track.width * (junction ? 0.83 : 0.96);
      pavers.set(id, tileGeometry(center, angle(distance), extent, width));
    });
  }
  return { centers, pavers, edges };
}
