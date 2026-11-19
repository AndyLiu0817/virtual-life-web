export type Orientation = "landscape" | "portrait";
export type Cell = readonly [column: number, row: number];
export type MapPoint = readonly [x: number, y: number];

export interface BoardLayout {
  width: number;
  height: number;
  pawnHeight: number;
  origin: readonly [x: number, y: number];
  // Project unit steps along the two ground axes onto screen diagonals.
  halfWidth: number;
  halfHeight: number;
  cells: readonly Cell[];
  // On painted roads, cells are measured source pixels. The first outline
  // bounds the road and subsequent outlines are the enclosed islands.
  road?: {
    outlines: readonly (readonly MapPoint[])[];
    // Ground footprints of major scenery, in the same source coordinates.
    obstacles?: readonly (readonly MapPoint[])[];
  };
}
