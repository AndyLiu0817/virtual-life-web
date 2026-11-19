import type { TileKind, Board } from "./junior";

export function schoolTiles(
  kinds: readonly TileKind[],
  shortcut: readonly [from: number, to: number, interior: number],
): Board["tiles"] {
  const [from, to, interior] = shortcut;
  const loopSize = kinds.length - interior;
  const routes = kinds.map((_, index) =>
    index < loopSize ? [(index + 1) % loopSize] : [],
  );
  const path = [
    from,
    ...Array.from({ length: interior }, (_, i) => loopSize + i),
    to,
  ];
  path.slice(1).forEach((id, i) => {
    routes[path[i]].push(id);
    routes[id].push(path[i]);
  });
  return kinds.map((kind, index) => ({ kind, next: routes[index] }));
}
