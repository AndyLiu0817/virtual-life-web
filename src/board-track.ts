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
  const depth = 5.5;
  const roundX = w * clayRadius;
  const roundY = h * clayRadius;
  const outerX = w - roundX;
  const frontY = h - roundY;
  // The two rounded front faces are extruded vertically in screen space.
  const wall = `M ${-outerX} ${-roundY}
    Q ${-w} 0 ${-outerX} ${roundY}
    L ${-roundX} ${frontY} Q 0 ${h} ${roundX} ${frontY}
    L ${outerX} ${roundY} Q ${w} 0 ${outerX} ${-roundY}
    V ${depth - roundY} Q ${w} ${depth} ${outerX} ${depth + roundY}
    L ${roundX} ${depth + frontY} Q 0 ${depth + h} ${-roundX} ${depth + frontY}
    L ${-outerX} ${depth + roundY} Q ${-w} ${depth} ${-outerX} ${depth - roundY} Z`;
  const centers = layout.cells.map((cell) => project(layout, cell));
  const tileTop = ({ x, y }: (typeof centers)[number]) =>
    `matrix(${w} ${h} ${-w} ${h} ${x} ${y})`;
  return { centers, wall, tileTop };
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
