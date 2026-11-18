import type { BoardLayout } from "./data/board-layout";

type Point = { x: number; y: number };
type Lane = {
  point: (distance: number) => Point;
  angle: (distance: number) => number;
  distances: number[];
};

function ribbon(lane: Lane, width: number, from: number, to: number) {
  const steps = Math.max(1, Math.ceil((to - from) / 4));
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const sample = from + ((to - from) * i) / steps;
    const { x, y } = lane.point(sample);
    const tangent = lane.angle(sample);
    // The ground plane compresses the cross-track width on horizontal runs.
    const half =
      (width / 2) * Math.hypot(Math.sin(tangent), 0.62 * Math.cos(tangent));
    const dx = Math.sin(tangent) * half;
    const dy = Math.cos(tangent) * half;
    left.push(`${x - dx},${y + dy}`);
    right.push(`${x + dx},${y - dy}`);
  }
  return `M ${left.concat(right.reverse()).join(" L ")} Z`;
}

export function measureTrack(layout: BoardLayout) {
  const centers = new Map<number, Point>();
  const pavers = new Map<number, string>();
  const edges = new Map<string, (progress: number) => Point>();
  const symbols = new Map<number, string>();

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
    const lane: Lane = { point, angle, distances: [] };
    for (let span = 1; span < anchors.length; span++) {
      const [from, start] = anchors[span - 1];
      const [to, end] = anchors[span];
      for (let i = from; i <= to; i++) {
        lane.distances[i] =
          length * (start + ((end - start) * (i - from)) / (to - from));
      }
    }

    track.tiles.forEach((id, index) => {
      const distance = lane.distances[index];
      const center = point(distance);
      const junction = index === 0 || index === last;
      if (!centers.has(id)) centers.set(id, center);
      if (index > 0) {
        const previous = track.tiles[index - 1];
        const start = lane.distances[index - 1];
        const between = (progress: number) =>
          point(start + (distance - start) * progress);
        edges.set(`${previous}:${id}`, between);
        edges.set(`${id}:${previous}`, (progress) => between(1 - progress));
      }
      const limit = (track.maxPaverLength ?? Infinity) / 2;
      if (junction) {
        const neighbor = lane.distances[index === 0 ? 1 : last - 1];
        const extent = Math.max(
          Math.abs(neighbor - distance) / 2 - 1,
          Math.abs(neighbor - distance) - limit - 2,
        );
        const from = index === 0 ? 0 : distance - extent;
        const to = index === 0 ? extent : length;
        const arm = ribbon(lane, track.width, from, to);
        // A shared tile spans the ends of all incident lanes. Their ribbons
        // overlap at the center so the junction reads as a single paver.
        const hub = `M ${center.x - 18} ${center.y} a 18 12 0 1 0 36 0 a 18 12 0 1 0 -36 0 Z`;
        pavers.set(id, (pavers.get(id) ?? hub) + " " + arm);
        symbols.set(id, `translate(${center.x} ${center.y}) scale(0.95 0.64)`);
        return;
      }

      const from = Math.max(
        distance - limit,
        (lane.distances[index - 1] + distance) / 2 + 1,
      );
      const to = Math.min(
        distance + limit,
        (lane.distances[index + 1] + distance) / 2 - 1,
      );
      pavers.set(id, ribbon(lane, track.width, from, to));
      const degrees = (angle(distance) * 180) / Math.PI;
      const upright = ((degrees + 270) % 180) - 90;
      const iconScale = Math.min(1, (to - from) / 30, track.width / 32);
      symbols.set(
        id,
        `translate(${center.x} ${center.y}) rotate(${upright}) scale(${iconScale} ${iconScale * 0.68})`,
      );
    });
  }
  return { centers, pavers, edges, symbols };
}
