import type { BoardLayout, Cell } from "./data/board-layout";

function project(layout: BoardLayout, [column, row]: Cell) {
  return {
    x: layout.origin[0] + (column - row) * layout.halfWidth,
    y: layout.origin[1] + (column + row) * layout.halfHeight,
  };
}

export function measureTrack(layout: BoardLayout) {
  const { halfWidth, halfHeight } = layout;
  const tileWidth = halfWidth * 0.982;
  const tileHeight = halfHeight * 0.982;
  const centers = layout.cells.map((cell) => project(layout, cell));
  const pavers = centers.map(({ x, y }) => ({
    face: `M ${x} ${y - tileHeight} L ${x + tileWidth} ${y} L ${x} ${y + tileHeight} L ${x - tileWidth} ${y} Z`,
    print: `translate(${x} ${y}) scale(1 ${Math.min(0.78, (halfHeight / halfWidth) * 1.28)})`,
    iconSize: halfWidth * 0.98,
  }));
  return { centers, pavers };
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
