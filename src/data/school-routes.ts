import type { TileKind, Board } from "./junior";

export function schoolTiles(kinds: readonly TileKind[]): Board["tiles"] {
  return kinds.map((kind, index) => ({
    kind,
    next: [(index + 1) % kinds.length],
  }));
}
