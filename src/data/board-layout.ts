export type Orientation = "landscape" | "portrait";
export type Cell = readonly [column: number, row: number];

export interface BoardLayout {
  width: number;
  height: number;
  pawnHeight: number;
  origin: readonly [x: number, y: number];
  // Project unit steps along the two ground axes onto screen diagonals.
  halfWidth: number;
  halfHeight: number;
  cells: readonly Cell[];
}
