import type { BoardLayout, Orientation } from "./board-layout";
import { juniorLayouts } from "./junior-layout";
import { juniorLoop, juniorShortcut } from "./junior-routes";

export const tileLabels = {
  start: "起點",
  event: "事件",
  game: "遊戲",
  club: "社團",
  quiz: "小考",
  contest: "大賽",
  fork: "岔路",
  love: "愛情",
};

export type TileKind = keyof typeof tileLabels;
interface Tile {
  kind: TileKind;
  next: readonly number[];
}

export interface Board {
  turns: number;
  start: number;
  layouts: Record<Orientation, BoardLayout>;
  tiles: readonly Tile[];
}

// The first 18 entries retain their save IDs. Allocate the remaining event
// tiles by the MVP v3 ratio, keeping a single START and two junctions.
const tileKinds: readonly TileKind[] = [
  "start",
  "event",
  "game",
  "club",
  "fork",
  "quiz",
  "event",
  "game",
  "quiz",
  "event",
  "contest",
  "game",
  "event",
  "club",
  "fork",
  "quiz",
  "game",
  "event",
  "event",
  "game",
  "quiz",
  "contest",
  "event",
  "game",
  "quiz",
  "event",
  "event",
  "contest",
  "event",
  "game",
  "quiz",
  "event",
  "club",
  "game",
  "quiz",
  "event",
  "game",
  "club",
  "event",
  "club",
  "quiz",
  "game",
];

const routes = tileKinds.map(() => [] as number[]);
// The first option at each fork always follows the outer loop.
juniorLoop.forEach((id, index) =>
  routes[id].push(juniorLoop[(index + 1) % juniorLoop.length]),
);
juniorShortcut.slice(1).forEach((id, index) => {
  const previous = juniorShortcut[index];
  routes[previous].push(id);
  routes[id].push(previous);
});

export const juniorBoard: Board = {
  turns: 15,
  start: 0,
  layouts: juniorLayouts,
  tiles: tileKinds.map((kind, id) => ({ kind, next: routes[id] })),
};
