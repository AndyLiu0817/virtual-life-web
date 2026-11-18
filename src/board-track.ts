import type { BoardLayout, Cell } from "./data/board-layout";

function project(layout: BoardLayout, [column, row]: Cell) {
  return {
    x: layout.origin[0] + (column - row) * layout.halfWidth,
    y: layout.origin[1] + (column + row) * layout.halfHeight,
  };
}

// The crop and the extruded edge share this radius in ground coordinates.
export const clayRadius = 0.19;

export function measureTrack(layout: BoardLayout) {
  const w = layout.halfWidth * 0.982;
  const h = layout.halfHeight * 0.982;
  const depth = w * 0.2;
  const roundX = w * clayRadius;
  const roundY = h * clayRadius;
  const outerX = w - roundX;
  const frontY = h - roundY;
  const sideX = w - roundX / 2;
  // Split the left and right corner curves at their vertical tangents.
  // The upper and lower contours then connect without gaps or folded edges.
  const behind = `M ${-sideX} 0
    Q ${-sideX} ${-roundY / 2} ${-outerX} ${-roundY}
    L ${-roundX} ${-frontY} Q 0 ${-h} ${roundX} ${-frontY}
    L ${outerX} ${-roundY} Q ${sideX} ${-roundY / 2} ${sideX} 0`;
  const front = (y: number) =>
    `Q ${sideX} ${y + roundY / 2} ${outerX} ${y + roundY}
    L ${roundX} ${y + frontY} Q 0 ${y + h} ${-roundX} ${y + frontY}
    L ${-outerX} ${y + roundY} Q ${-sideX} ${y + roundY / 2} ${-sideX} ${y}`;
  const body = `${behind} V ${depth} ${front(depth)} Z`;
  const footprint = `${behind} ${front(0)} Z`;
  const centers = layout.cells.map((cell) => project(layout, cell));
  const tileTop = ({ x, y }: (typeof centers)[number]) =>
    `matrix(${w} ${h} ${-w} ${h} ${x} ${y})`;
  return { centers, body, footprint, depth, tileTop };
}

export function debugGrid(layout: BoardLayout) {
  const columns = layout.cells.map(([column]) => column);
  const rows = layout.cells.map(([, row]) => row);
  const left = Math.min(...columns) - 0.5;
  const right = Math.max(...columns) + 0.5;
  const top = Math.min(...rows) - 0.5;
  const bottom = Math.max(...rows) + 0.5;
  const line = (from: Cell, to: Cell) => {
    const a = project(layout, from);
    const b = project(layout, to);
    return `<path d="M ${a.x} ${a.y} L ${b.x} ${b.y}"/>`;
  };
  return [
    ...Array.from({ length: right - left + 1 }, (_, i) =>
      line([left + i, top], [left + i, bottom]),
    ),
    ...Array.from({ length: bottom - top + 1 }, (_, i) =>
      line([left, top + i], [right, top + i]),
    ),
  ].join("");
}
