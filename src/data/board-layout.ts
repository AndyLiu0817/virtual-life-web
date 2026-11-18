export type Orientation = "landscape" | "portrait";

export interface TrackSegment {
  // The first and last IDs are shared anchors. Interior IDs divide the
  // centerline by arc length, irrespective of the Bézier control points.
  tiles: readonly number[];
  path: string;
  width: number;
  offsets?: Readonly<Record<number, number>>;
  maxPaverLength?: number;
}

export interface BoardLayout {
  width: number;
  height: number;
  pawnHeight: number;
  tracks: readonly TrackSegment[];
}
