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
  // Reference road outlines are in source pixels. The first outline bounds
  // the road, and subsequent outlines describe the enclosed islands.
  road?: {
    outlines: readonly (readonly MapPoint[])[];
    // Building and ground obstacles on the gameplay map. Raised vegetation
    // and lights are handled separately by the foreground silhouettes.
    obstacles?: readonly (readonly MapPoint[])[];
  };
}
